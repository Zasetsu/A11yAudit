# Security Policy

A11yAudit opens user-supplied URLs during audits. Security reports related to SSRF, private-network access, browser isolation, artifact leakage, or report integrity are in scope.

Please report security issues privately to security@example.com. This is a placeholder address and should be replaced before public project launch.

## URL Fetching Boundary

A11yAudit rejects private, loopback, link-local, and unsupported protocol targets for normal scans. Localhost is allowed only inside tests. Redirect validation and DNS rebinding hardening remain security-sensitive areas and should be reviewed before exposing the server outside a trusted network.

Do not publish active exploitation details publicly before maintainers have had time to respond.
