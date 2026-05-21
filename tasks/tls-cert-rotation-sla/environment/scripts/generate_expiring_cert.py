#!/usr/bin/env python3
"""
generate_expiring_cert.py — Generate a self-signed TLS certificate that expires
in approximately 15 minutes. This creates time pressure for the agent.

Uses the Python cryptography library for precise validity control.
"""

import datetime
import os

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

SSL_DIR = "/etc/nginx/ssl"
CERT_PATH = os.path.join(SSL_DIR, "server.crt")
KEY_PATH = os.path.join(SSL_DIR, "server.key")

# Certificate validity: 15 minutes from now
VALIDITY_MINUTES = 15


def generate_expiring_cert():
    os.makedirs(SSL_DIR, exist_ok=True)

    # Generate RSA private key
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    # Build certificate
    now = datetime.datetime.now(datetime.timezone.utc)
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "California"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "WebApp Inc"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ]
    )

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=365))
        .not_valid_after(now + datetime.timedelta(minutes=VALIDITY_MINUTES))
        .add_extension(
            x509.SubjectAlternativeName(
                [
                    x509.DNSName("localhost"),
                    x509.IPAddress(__import__("ipaddress").IPv4Address("127.0.0.1")),
                ]
            ),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )

    # Write private key
    with open(KEY_PATH, "wb") as f:
        f.write(
            key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )

    # Write certificate
    with open(CERT_PATH, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    expiry = now + datetime.timedelta(minutes=VALIDITY_MINUTES)
    print(f"[cert-gen] Certificate generated: expires at {expiry.isoformat()}")
    print(f"[cert-gen]   Cert: {CERT_PATH}")
    print(f"[cert-gen]   Key:  {KEY_PATH}")


if __name__ == "__main__":
    generate_expiring_cert()
