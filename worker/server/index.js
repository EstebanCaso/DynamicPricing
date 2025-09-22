import express from 'express'
import { spawn } from 'node:child_process'

const app = express()
app.use(express.json({ limit: '1mb' }))

function requireKey(req, res, next) {
  const key = req.get('x-api-key')
  if (!key || key !== process.env.WORKER_API_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }
  next()
}

function runScript(scriptPath, args = [], extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, ...args], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...extraEnv },
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => { out += d.toString() })
    child.stderr.on('data', (d) => { err += d.toString() })
    child.on('close', (code) => resolve({ code, out, err }))
  })
}

app.get('/health', (req, res) => res.json({ ok: true }))

app.post('/amadeus', requireKey, async (req, res) => {
  const { latitude, longitude, radius = 30, keyword = null, userUuid, saveToDb = false } = req.body || {}
  if (!latitude || !longitude) return res.status(400).json({ ok: false, error: 'missing lat/lon' })

  const args = [String(latitude), String(longitude), `--radius=${radius}`]
  if (keyword) args.push(`--keyword=${keyword}`)
  if (saveToDb && userUuid) args.push(`--user-id=${userUuid}`, '--save')

  const { code, out, err } = await runScript('scripts/amadeus_hotels.js', args)
  if (code === 0) return res.json({ ok: true, output: out })
  return res.status(500).json({ ok: false, output: out, error: err || 'failed' })
})

app.post('/hotel', requireKey, async (req, res) => {
  const { userUuid, hotelName, days = 90, concurrency = 5, headless = true, userJwt } = req.body || {}
  if (!userUuid || !hotelName) return res.status(400).json({ ok: false, error: 'missing userUuid/hotelName' })

  const args = [userUuid, hotelName, `--days=${days}`, `--concurrency=${concurrency}`]
  if (headless) args.push('--headless')

  const { code, out, err } = await runScript('scripts/hotel_propio.js', args, userJwt ? { USER_JWT: userJwt } : {})
  if (code === 0) return res.json({ ok: true, output: out })
  return res.status(500).json({ ok: false, output: out, error: err || 'failed' })
})

app.post('/events', requireKey, async (req, res) => {
  const { latitude, longitude, radius = 50, userJwt } = req.body || {}
  const args = []
  if (latitude && longitude) args.push(String(latitude), String(longitude), String(radius))

  const { code, out, err } = await runScript('scripts/scrape_songkick.js', args, userJwt ? { USER_JWT: userJwt } : {})
  if (code === 0) return res.json({ ok: true, output: out })
  return res.status(500).json({ ok: false, output: out, error: err || 'failed' })
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log('Worker listening on', PORT)
})
