const { Buffer } = require("node:buffer");
const express = require("express");

const router = express.Router();

const OTAKUDESU_AJAX_URL = "https://otakudesu.blog/wp-admin/admin-ajax.php";
const NONCE_ACTION = "aa1208d27f29ca340c92c66d1926f13f";
const MIRROR_ACTION = "2a3505c93b0035d3f455df82bf976b84";
const FETCH_TIMEOUT_MS = 12000;
const NONCE_TTL_MS = 10 * 60 * 1000;
const MIRROR_CACHE_TTL_MS = 60 * 60 * 1000;

const AJAX_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  Accept: "application/json, text/javascript, */*; q=0.01",
  Origin: "https://otakudesu.blog",
  Referer: "https://otakudesu.blog/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
};

let cachedNonce = null;
const resolvedMirrorCache = new Map();

const extractIframeUrl = (html) => {
  const match = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
};

const fetchWithTimeout = async (url, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const getNonce = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedNonce && cachedNonce.expiresAt > now) {
    return cachedNonce.value;
  }

  const nonceResponse = await fetchWithTimeout(OTAKUDESU_AJAX_URL, {
    method: "POST",
    headers: AJAX_HEADERS,
    body: new URLSearchParams({
      action: NONCE_ACTION,
    }),
  });

  if (!nonceResponse.ok) {
    throw new Error("Gagal mengambil token mirror dari server sumber.");
  }

  const nonceResult = await nonceResponse.json();
  const nonce = nonceResult.data;

  if (!nonce) {
    throw new Error("Token mirror tidak dikembalikan oleh server sumber.");
  }

  cachedNonce = {
    value: nonce,
    expiresAt: now + NONCE_TTL_MS,
  };

  return nonce;
};

const requestMirror = async (payload, nonce) => {
  const mirrorResponse = await fetchWithTimeout(OTAKUDESU_AJAX_URL, {
    method: "POST",
    headers: AJAX_HEADERS,
    body: new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [key, String(value)]),
      ),
      nonce,
      action: MIRROR_ACTION,
    }),
  });

  if (!mirrorResponse.ok) {
    throw new Error("Server sumber menolak permintaan mirror stream.");
  }

  const mirrorResult = await mirrorResponse.json();
  const encodedHtml = mirrorResult.data;

  if (!encodedHtml) {
    throw new Error("Data embed mirror tidak dikembalikan oleh server sumber.");
  }

  const embedHtml = Buffer.from(encodedHtml, "base64").toString("utf-8");
  const iframeUrl = extractIframeUrl(embedHtml);

  if (!iframeUrl) {
    throw new Error("URL iframe mirror tidak ditemukan pada respons server sumber.");
  }

  return iframeUrl;
};

router.post("/episode-mirror", async (req, res) => {
  try {
    const { dataContent } = req.body || {};

    if (!dataContent) {
      return res.status(400).json({
        error: "Missing mirror data content.",
      });
    }

    const cachedMirror = resolvedMirrorCache.get(dataContent);
    if (cachedMirror && cachedMirror.expiresAt > Date.now()) {
      return res.json({ iframeUrl: cachedMirror.iframeUrl });
    }

    const decodedPayload = JSON.parse(
      Buffer.from(dataContent, "base64").toString("utf-8"),
    );

    let iframeUrl;

    try {
      const nonce = await getNonce(false);
      iframeUrl = await requestMirror(decodedPayload, nonce);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const shouldRetry =
        message.includes("ditolak") ||
        message.includes("tidak dikembalikan") ||
        message.includes("tidak ditemukan");

      if (!shouldRetry) {
        throw error;
      }

      const freshNonce = await getNonce(true);
      iframeUrl = await requestMirror(decodedPayload, freshNonce);
    }

    resolvedMirrorCache.set(dataContent, {
      iframeUrl,
      expiresAt: Date.now() + MIRROR_CACHE_TTL_MS,
    });

    return res.json({ iframeUrl });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Permintaan mirror ke server sumber timeout."
        : error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat memuat mirror stream.";

    return res.status(500).json({ error: message });
  }
});

module.exports = router;
