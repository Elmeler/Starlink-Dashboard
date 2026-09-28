/**
 * Compact OUI → device-type lookup.
 * Returns one of: 'phone' | 'laptop' | 'tv' | 'iot' | 'router' | 'unknown'
 *
 * Keys are the first three MAC octets, lowercase with colons.
 * This covers the most common home-network OUI prefixes; everything
 * else falls back to 'unknown'.
 */
const OUI_DB = new Map([
  // ── Raspberry Pi Foundation ─────────────────────────────────────────────
  ['dc:a6:32','iot'], ['b8:27:eb','iot'], ['e4:5f:01','iot'], ['2c:cf:67','iot'],
  // ── Amazon (Echo, Fire TV, Ring, Alexa) ─────────────────────────────────
  ['fc:65:de','iot'], ['74:c2:46','iot'], ['a4:08:ea','iot'], ['4c:bf:9c','iot'],
  ['40:b4:cd','iot'], ['34:d2:70','iot'], ['84:d6:d0','iot'], ['68:54:fd','iot'],
  ['b4:7c:9c','iot'], ['f0:27:2d','iot'], ['18:74:2e','iot'], ['ac:63:be','iot'],
  // ── Google (Nest, Home, Chromecast) ─────────────────────────────────────
  ['54:60:7e','iot'], ['a4:97:7a','iot'], ['3c:5a:b4','iot'], ['f4:f5:e8','iot'],
  ['20:df:b9','iot'], ['48:d6:d5','iot'], ['b8:5a:73','iot'], ['1c:f2:9a','iot'],
  ['d8:6c:63','iot'], ['f0:ef:86','iot'], ['54:f2:01','iot'],
  // ── Apple (iPhone, iPad, Mac – one icon covers all) ─────────────────────
  ['3c:15:c2','laptop'], ['a8:5c:2c','laptop'], ['f4:5c:89','laptop'],
  ['28:6a:ba','laptop'], ['8c:85:90','laptop'], ['a4:83:e7','laptop'],
  ['20:ee:28','laptop'], ['04:f7:e4','laptop'], ['d4:9a:20','laptop'],
  ['c8:e0:eb','laptop'], ['70:48:0f','laptop'], ['bc:92:6b','laptop'],
  ['34:ab:37','laptop'], ['f0:db:f8','laptop'], ['60:f8:1d','laptop'],
  ['8c:8d:28','laptop'], ['dc:2b:2a','laptop'], ['3c:22:fb','laptop'],
  ['f0:18:98','laptop'], ['b8:09:8a','laptop'],
  // ── Samsung (Galaxy phones / tablets) ───────────────────────────────────
  ['a4:eb:d3','phone'], ['2c:ae:2b','phone'], ['bc:20:a4','phone'],
  ['2c:f4:c5','phone'], ['a4:f4:c2','phone'], ['04:18:d6','phone'],
  ['f0:25:b7','phone'], ['78:1f:db','phone'], ['50:cc:f8','phone'],
  ['8c:71:f8','phone'], ['b0:c4:e7','phone'], ['cc:07:ab','phone'],
  ['48:13:7e','phone'], ['1c:62:b8','phone'], ['70:f9:27','phone'],
  // ── Roku streaming sticks / players ─────────────────────────────────────
  ['b0:a7:37','tv'],  ['dc:3a:5e','tv'],  ['88:de:a9','tv'],
  ['c8:3a:6b','tv'],  ['cc:6d:a0','tv'],  ['08:05:81','tv'],
  // ── Sony (Bravia TVs, PlayStation) ──────────────────────────────────────
  ['e0:91:f5','tv'],  ['ac:9b:0a','tv'],  ['70:26:05','tv'],
  ['f0:bf:97','tv'],  ['28:3f:69','tv'],
  // ── Sonos speakers ──────────────────────────────────────────────────────
  ['5c:aa:fd','tv'],  ['94:9f:3e','tv'],  ['b8:e9:37','tv'],  ['78:28:ca','tv'],
  // ── Apple TV ────────────────────────────────────────────────────────────
  ['a8:be:27','tv'],  ['d0:03:4b','tv'],
  // ── Nintendo Switch ─────────────────────────────────────────────────────
  ['98:e8:fa','iot'], ['7c:bb:8a','iot'], ['0c:b8:15','iot'],
  // ── Philips Hue (smart lighting) ────────────────────────────────────────
  ['00:17:88','iot'], ['ec:b5:fa','iot'],
  // ── Ubiquiti (APs / routers) ─────────────────────────────────────────────
  ['24:a4:3c','router'], ['78:8a:20','router'], ['f4:92:bf','router'],
  ['68:72:51','router'], ['44:d9:e7','router'],
  // ── TP-Link ──────────────────────────────────────────────────────────────
  ['50:c7:bf','router'], ['18:d6:c7','router'], ['54:af:97','router'],
  ['98:da:c4','router'], ['c4:6e:1f','router'],
  // ── Netgear ──────────────────────────────────────────────────────────────
  ['a0:04:60','router'], ['b0:39:56','router'], ['6c:b0:ce','router'],
  // ── Eero ─────────────────────────────────────────────────────────────────
  ['f4:f5:db','router'], ['44:65:0d','router'],
  // ── SpaceX / Starlink hardware (TIBRO Corp. — SpaceX subsidiary) ─────────
  ['74:24:9f','router'],
])

/**
 * Given a MAC address string (any common format), return the device type.
 * @param {string|null} mac
 * @returns {'phone'|'laptop'|'tv'|'iot'|'router'|'unknown'}
 */
export function getDeviceType(mac) {
  if (!mac) return 'unknown'
  const norm    = mac.toLowerCase().replace(/[-\s]/g, ':')
  const prefix  = norm.split(':').slice(0, 3).join(':')
  return OUI_DB.get(prefix) ?? 'unknown'
}
