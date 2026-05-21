# TLS Certificate Rotation Runbook

**Service**: WebApp Production (Nginx reverse proxy)
**Author**: _[TO BE FILLED]_
**Last Updated**: _[TO BE FILLED]_

---

## 1. Pre-Rotation Checks

- [ ] Verify current certificate expiry date:
  ```
  [FILL IN: command to check current cert expiry]
  ```
- [ ] Confirm backend health:
  ```
  [FILL IN: command to verify backend is running]
  ```
- [ ] Note current time for downtime tracking: _______________

## 2. Generate New Certificate

```bash
# [FILL IN: exact openssl or other command used to generate new cert]
```

Certificate details:
- Common Name: _______________
- Validity period: _______________
- Key size: _______________

## 3. Install Certificate

```bash
# [FILL IN: commands to install cert and key to correct paths]
```

## 4. Reload Nginx

```bash
# [FILL IN: command to reload Nginx without downtime]
```

## 5. Post-Rotation Verification

- [ ] HTTPS responds with 200:
  ```
  [FILL IN: curl command and expected output]
  ```
- [ ] New certificate expiry confirmed:
  ```
  [FILL IN: command to verify new cert expiry date]
  ```
- [ ] Access logs are being written:
  ```
  [FILL IN: how you verified logging is working]
  ```

## 6. Logging Fix

**Issue found**: _[DESCRIBE THE LOGGING ISSUE]_

**Root cause**: _[DESCRIBE THE ROOT CAUSE]_

**Fix applied**:
```
[FILL IN: what you changed in nginx.conf]
```

## 7. Incident Timeline

| Time | Event |
|------|-------|
| _[FILL]_ | Alert received |
| _[FILL]_ | Investigation started |
| _[FILL]_ | New certificate generated |
| _[FILL]_ | Certificate installed and Nginx reloaded |
| _[FILL]_ | HTTPS verified working |
| _[FILL]_ | Logging fix applied |

## 8. Total Downtime

**Estimated HTTPS downtime**: _______________ seconds

---

_End of runbook_
