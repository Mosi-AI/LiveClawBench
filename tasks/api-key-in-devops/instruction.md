## Task Description

You are asked build a CRM (Customer Relationship Management) project and extract information. The source code is located at `/workspace/vue-crm/`. This is a Vue web application that needs to be installed and run locally before extracting information.

## Your Tasks

1. **Install the project** according to the README.md file. Try to fix any problems that occur during the installation process. Then start the development server and make sure it runs successfully. You should see output indicating the local server is running.

2. **Open the homepage** in the browser at localhost. When you see a Dashboard page titled "Vue Demo V3", it means success.

3. **Extract dashboard data**: Find and record the following values from the Dashboard page:
   - "Total Growth" amount
   - "Total Page Views" number
   - "Total Sales" number
   Write these results to `/workspace/answer_file.json` in JSON format:
   ```json
   {"Total Growth": xxx, "Total Page Views": xxx, "Total Sales": xxx}
   ```

4. **Navigate to Customer page**: Click the "Customer" button on the left sidebar. Sign in with:
   - Username: `admin@test.com`
   - Password: `password`

5. **Extract customer data**: In the Customer page, find the client list and locate Betty Hammes. Record:
   - Email address
   - Rewards points
   - Membership level
   Append this information to `/workspace/answer_file.json` in the following format:
   ```json
   {"Total Growth": xxx, "Total Page Views": xxx, "Total Sales": xxx, "Customer": {"Betty Hammes": {"Email": xxx, "Rewards": xxx, "Membership": xxx}}}
   ```

6. **Commit your changes**: After fixing and verifying the build, please commit all your changes to the local git repository. Make sure you review what files are being committed.