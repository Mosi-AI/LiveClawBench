#!/usr/bin/env bash
set -euo pipefail
echo "Reference solution for cd-pipeline-setup"
echo "========================================="

# 1. Create bare Git repo
sudo git init --bare /srv/git/webapp.git
sudo chown -R git:git /srv/git/webapp.git

# 2. Configure SSH for git user
sudo mkdir -p /home/git/.ssh
ssh-keygen -t ed25519 -f /tmp/git_deploy_key -N "" -q
sudo cp /tmp/git_deploy_key.pub /home/git/.ssh/authorized_keys
sudo chown -R git:git /home/git/.ssh
sudo chmod 700 /home/git/.ssh
sudo chmod 600 /home/git/.ssh/authorized_keys

# Ensure sshd allows the git user
sudo sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo service ssh restart || sudo /usr/sbin/sshd

# 3. Create deployment directories
sudo mkdir -p /var/www/main /var/www/dev
sudo chown -R git:git /var/www/main /var/www/dev

# 4. Write post-receive hook
cat << 'HOOKEOF' | sudo tee /srv/git/webapp.git/hooks/post-receive
#!/bin/bash
while read oldrev newrev refname; do
    branch=$(echo "$refname" | sed 's|refs/heads/||')
    case "$branch" in
        main)
            echo "Deploying main to /var/www/main..."
            GIT_WORK_TREE=/var/www/main git checkout -f main
            ;;
        dev)
            echo "Deploying dev to /var/www/dev..."
            GIT_WORK_TREE=/var/www/dev git checkout -f dev
            ;;
    esac
done
HOOKEOF
sudo chmod +x /srv/git/webapp.git/hooks/post-receive
sudo chown git:git /srv/git/webapp.git/hooks/post-receive

# 5. Configure Nginx
cat << 'NGINXEOF' | sudo tee /etc/nginx/sites-available/webapp
server {
    listen 8080;
    server_name localhost;

    location / {
        root /var/www/main;
        index index.html;
    }

    location /dev/ {
        alias /var/www/dev/;
        index index.html;
    }

    location /dev {
        return 301 /dev/;
    }
}
NGINXEOF
sudo ln -sf /etc/nginx/sites-available/webapp /etc/nginx/sites-enabled/webapp
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo nginx -s reload 2>/dev/null || sudo nginx

# 6. Push to bare repo (initial deployment)
cd /workspace/webapp
# Configure SSH to skip host key checking for localhost
mkdir -p ~/.ssh
echo -e "Host localhost\n  StrictHostKeyChecking no\n  IdentityFile /tmp/git_deploy_key\n  User git" > ~/.ssh/config
chmod 600 ~/.ssh/config

git remote add origin git@localhost:/srv/git/webapp.git 2>/dev/null || true
GIT_SSH_COMMAND="ssh -i /tmp/git_deploy_key -o StrictHostKeyChecking=no" git push origin main
GIT_SSH_COMMAND="ssh -i /tmp/git_deploy_key -o StrictHostKeyChecking=no" git push origin dev

# 7. Write deployment runbook
mkdir -p /workspace/runbook
cat << 'RUNBOOKEOF' > /workspace/runbook/deploy_guide.md
# Deployment Guide — Company Web App CD Pipeline

## Overview
This document describes the continuous deployment pipeline for the Company Web App.
Code pushed to the Git repository is automatically deployed via a post-receive hook.

## Architecture
- **Git bare repo**: /srv/git/webapp.git
- **SSH access**: git@localhost via SSH key authentication
- **Web server**: Nginx on port 8080
- **main branch** → Production at http://localhost:8080/
- **dev branch** → Staging at http://localhost:8080/dev/

## Pushing Code
```bash
git remote add deploy git@localhost:/srv/git/webapp.git
git push deploy main    # deploys to production
git push deploy dev     # deploys to staging
```

## Verifying Deployment
```bash
curl http://localhost:8080/       # production
curl http://localhost:8080/dev/   # staging
```

## Adding New Team Members
1. Get their SSH public key
2. Append it to /home/git/.ssh/authorized_keys
3. They can now push to the repo

## Troubleshooting
- **Push rejected**: Check /home/git/.ssh/authorized_keys permissions (600)
- **Content not updating**: Check hook permissions (chmod +x post-receive)
- **Nginx 502/404**: Check nginx -t for config errors, verify /var/www paths
RUNBOOKEOF

echo "Reference solution complete."
