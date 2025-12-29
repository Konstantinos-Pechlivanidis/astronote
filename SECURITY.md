# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please report it privately:

### Email Security Issues

Send security reports to: [security@astronote.com]

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: As soon as possible based on severity

### Security Best Practices

When reporting vulnerabilities, please:

1. **Do not** disclose publicly until we've addressed it
2. Provide detailed reproduction steps
3. Include potential impact assessment
4. Allow reasonable time for fixes

## Security Features

### Current Security Measures

- ✅ **Authentication**: JWT-based authentication
- ✅ **Authorization**: Role-based access control
- ✅ **Rate Limiting**: Per-tenant rate limiting
- ✅ **Input Validation**: Zod schema validation
- ✅ **SQL Injection Protection**: Prisma ORM
- ✅ **XSS Protection**: React's built-in escaping
- ✅ **CSRF Protection**: Token-based validation
- ✅ **Webhook Security**: HMAC signature verification
- ✅ **PII Redaction**: Safe logging practices
- ✅ **HTTPS Only**: Enforced in production

### Security Checklist

Before deploying:

- [ ] All dependencies are up to date
- [ ] Environment variables are secure
- [ ] Database credentials are rotated
- [ ] API keys are stored securely
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Webhook signatures are verified
- [ ] PII is redacted in logs

## Known Security Considerations

### Environment Variables

- Never commit `.env` files
- Use strong, unique secrets
- Rotate secrets regularly
- Use different secrets per environment

### Database

- Use connection pooling
- Enable SSL/TLS connections
- Restrict database access
- Regular backups

### API Security

- Validate all inputs
- Sanitize user data
- Use parameterized queries
- Implement rate limiting

## Updates

Security updates will be communicated through:
- GitHub Security Advisories
- Release notes
- Direct notification (for critical issues)

Thank you for helping keep Astronote secure!

