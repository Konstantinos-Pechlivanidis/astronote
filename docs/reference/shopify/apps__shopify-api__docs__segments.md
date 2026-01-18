# System Segments Documentation

**Date**: 2025-01-XX  
**Purpose**: Document DB-backed system segments (gender + age buckets)

## Overview

System segments are read-only, automatically created per shop segments for gender and age-based targeting. They are stored in the database and resolved dynamically based on contact criteria.

## Segment Model

```prisma
model Segment {
  id          String   @id @default(cuid())
  shopId      String
  name        String
  key         String?  // Unique per shop (e.g., "gender_male")
  type        String   @default("custom") // "system" | "custom"
  criteriaJson Json?   // Structured criteria
  ruleJson    Json     // Legacy field (backward compat)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([shopId, name])
  @@unique([shopId, key])  // For system segments
  @@index([shopId, type])
}
```

## System Segments

### Gender Segments

| Key | Name | Criteria |
|-----|------|----------|
| `gender_male` | Male | `{ "gender": "male" }` |
| `gender_female` | Female | `{ "gender": "female" }` |
| `gender_unknown` | Unknown Gender | `{ "gender": null }` |

### Age Bucket Segments

| Key | Name | Criteria |
|-----|------|----------|
| `age_18_24` | Age 18-24 | `{ "age": { "gte": 18, "lte": 24 } }` |
| `age_25_34` | Age 25-34 | `{ "age": { "gte": 25, "lte": 34 } }` |
| `age_35_44` | Age 35-44 | `{ "age": { "gte": 35, "lte": 44 } }` |
| `age_45_54` | Age 45-54 | `{ "age": { "gte": 45, "lte": 54 } }` |
| `age_55_plus` | Age 55+ | `{ "age": { "gte": 55 } }` |

**Note**: Age segments exclude contacts without `birthDate` (null birthdays).

## Idempotent Seeding

System segments are automatically created on first access to `GET /audiences/segments`:

```javascript
await prisma.segment.createMany({
  data: segmentsToCreate,
  skipDuplicates: true, // Based on @@unique([shopId, key])
});
```

This ensures:
- Segments exist for all shops
- No duplicates (idempotent)
- Per-shop isolation

## Contact Resolution

### Gender Segments

Direct Prisma query:
```javascript
where: {
  shopId,
  smsConsent: 'opted_in',
  gender: 'male' // or 'female' or null
}
```

### Age Segments

Age calculation from `birthDate`:
```javascript
// Calculate age from birthDate
const age = calculateAge(contact.birthDate);

// Filter by age range
if (gte !== undefined && age < gte) return false;
if (lte !== undefined && age > lte) return false;
```

**Excludes**: Contacts with `birthDate = null`

## API Endpoints

### GET /audiences/segments

Returns all system segments for the current shop.

**Response**:
```json
{
  "success": true,
  "data": {
    "segments": [
      {
        "id": "segment123",
        "key": "gender_male",
        "name": "Male",
        "type": "system",
        "criteria": { "gender": "male" },
        "isActive": true,
        "createdAt": "2025-01-20T10:00:00Z"
      }
    ],
    "total": 8
  }
}
```

### GET /audiences/segments/:id

Get segment details by ID.

### GET /audiences/segments/:id/preview

Get estimated contact count for segment (without full resolution).

## Campaign Integration

When creating a campaign with segment audience:

```json
{
  "audience": {
    "type": "segment",
    "segmentId": "segment123"
  }
}
```

The campaign service:
1. Validates segment belongs to shop
2. Resolves contacts using segment criteria
3. Filters by `smsConsent: 'opted_in'`
4. Creates campaign recipients

## Performance

- **Indexes**: `shopId`, `type`, `key` for fast lookups
- **Resolution**: Uses Prisma queries (not in-memory)
- **Caching**: Consider caching segment counts if needed

## Security

- **Tenant Isolation**: All queries filtered by `shopId`
- **Validation**: Segment ownership validated before resolution
- **Read-Only**: System segments cannot be modified (only custom segments)

