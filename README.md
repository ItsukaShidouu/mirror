# Express Mirror API

Gunakan file ini di backend `be.ness.web.id` yang memakai Express/Node.js.

## File

- `episode-mirror.route.js`
- `server.example.js`

## Cara pakai

1. Install dependency di backend Express Anda:

```bash
npm install express cors
```

2. Salin `episode-mirror.route.js` ke project backend Anda.

3. Mount route ini di server Express:

```js
const express = require("express");
const cors = require("cors");
const episodeMirrorRouter = require("./episode-mirror.route");

const app = express();

app.use(cors({
  origin: [
    "https://ani.ness.web.id",
    "https://ani.ness.biz.id",
    "http://localhost:3000",
  ],
}));
app.use(express.json({ limit: "1mb" }));
app.use("/api", episodeMirrorRouter);
```

4. Pastikan endpoint aktif di:

```text
https://be.ness.web.id/api/episode-mirror
```

## Request

`POST /api/episode-mirror`

```json
{
  "dataContent": "eyJpZCI6MTk0NDE1LCJpIjowLCJxIjoiNzIwcCJ9"
}
```

## Response sukses

```json
{
  "iframeUrl": "https://desustream.info/dstream/ondesu/new/hd/index.php?id=..."
}
```

## Env frontend

Di frontend Next.js/Vercel, set env ini:

```text
NEXT_PUBLIC_EXPRESS_API_URL=https://be.ness.web.id/api
```

Setelah itu redeploy frontend.
