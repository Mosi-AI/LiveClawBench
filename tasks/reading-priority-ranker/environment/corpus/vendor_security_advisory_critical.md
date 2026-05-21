# Security Advisory: Critical CVE in DataStream Connector v4.x

**Severity:** CRITICAL (CVSS 9.1)  
**Affected Component:** DataStream Kafka Connector, versions 4.0–4.8  
**Published:** 2026-05-18  
**Advisory ID:** DSA-2026-042

## Vulnerability Summary

A remote code execution vulnerability (CVE-2026-3847) was discovered in the DataStream
Kafka Connector authentication handler. An unauthenticated attacker can execute arbitrary
commands on the connector host by sending a malformed SASL token.

## Impact

Any deployment using DataStream Connector v4.x with SASL/PLAIN or SASL/SCRAM
authentication is at risk. This includes all streaming pipeline integrations using
the connector for change-data-capture (CDC).

The Nova Analytics Platform infrastructure uses DataStream Connector v4.6.

## Required Action

**This vulnerability MUST be patched before the Q2 production deployment scheduled for
next Monday (2026-05-25).** Deploying the connector in its current state to production
violates the company's security policy and will be blocked by the security gate.

Upgrade path: update to DataStream Connector v4.9.1 (patch release).
Patch notes and upgrade guide: available on the vendor portal.

## Contact

Infrastructure Security Team: infosec@mosi-work.inc
