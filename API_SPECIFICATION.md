# Expected API Specification for localhost:3001

Based on the current HttpBackend implementation, the API should provide these endpoints:

## POST /api/translations (Fetch Translations)
**Request Body:**
```json
{
  "systemId": "string",
  "languageCode": "string"
}
```

**Response Format:**
```json
{
  "translations": [
    {
      "id": "string",
      "key": "string", 
      "original": "string",
      "translation": "string",
      "translated": boolean,
      "catalogue": "string",
      "modified": boolean
    }
  ]
}
```

## POST /api/translations (Upload Translations)
**Request Body:**
```json
{
  "systemId": "string",
  "languageCode": "string", 
  "translations": [
    {
      "id": "string",
      "key": "string",
      "original": "string", 
      "translation": "string",
      "translated": boolean,
      "catalogue": "string",
      "modified": boolean
    }
  ]
}
```

**Response:** Status 200 OK (no body required)

## POST /api/stats
**Request Body:**
```json
{
  "systemId": "string"
}
```

**Response Format:**
```json
{
  "totalStrings": number,
  "translatedCount": number,
  "languages": {
    "fr": { "translated": number, "total": number },
    "es": { "translated": number, "total": number }
  }
}
```

## Current Issues
The API calls are failing, which could be due to:
1. Different endpoint paths expected by the server
2. Different request/response formats
3. CORS issues
4. Server not running on localhost:3001