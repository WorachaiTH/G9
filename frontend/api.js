const express = require('express');
const http = require('node:http');
const https = require('node:https');
const { randomBytes } = require('node:crypto');

const router = express.Router();
const sessions = new Map();
const backendUrl = new URL(process.env.BACKEND_URL || 'http://localhost:8080');
const transport = backendUrl.protocol === 'https:' ? https : http;
const employeeIdPattern = /^\d+$/;

function getToken(req) {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+([a-f0-9]+)$/i);
    return match ? match[1] : null;
}

function getSessionEmail(req) {
    const token = getToken(req);
    return token ? sessions.get(token) : null;
}

function sendBackendRequest(path, method, body, contentType) {
    return new Promise((resolve, reject) => {
        const request = transport.request(
            {
                hostname: backendUrl.hostname,
                port: backendUrl.port || (backendUrl.protocol === 'https:' ? 443 : 80),
                path,
                method,
                headers: {
                    host: backendUrl.host,
                    ...(body ? { 'content-length': body.length, 'content-type': contentType } : {}),
                },
            },
            (response) => {
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => {
                    resolve({
                        status: response.statusCode || 502,
                        body: Buffer.concat(chunks).toString('utf8'),
                    });
                });
            },
        );

        request.on('error', reject);
        if (body) request.write(body);
        request.end();
    });
}

function postToApi(post) {
    const contactInfo = String(post.contactInfo || '');
    const separator = contactInfo.indexOf(' · ');
    const hasLegacyContact = !post.contactName && separator >= 0;

    return {
        id: post.id,
        type: String(post.type).toLowerCase(),
        desc: post.description || post.title || '',
        place: post.location || '',
        name: post.contactName || (hasLegacyContact
            ? contactInfo.slice(0, separator)
            : post.authorEmail || ''),
        contact: hasLegacyContact
            ? contactInfo.slice(separator + 3)
            : contactInfo,
        img: post.imageUrls?.[0] || null,
        createdAt: post.createdAt || null,
    };
}

function createMultipartPost(post, image) {
    const boundary = `----lost-and-found-${randomBytes(16).toString('hex')}`;
    const parts = [
        Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="post"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(post)}\r\n`,
        ),
    ];

    if (image) {
        parts.push(
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="upload.${image.extension}"\r\nContent-Type: ${image.contentType}\r\n\r\n`,
            ),
            image.data,
            Buffer.from('\r\n'),
        );
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`));
    return {
        body: Buffer.concat(parts),
        contentType: `multipart/form-data; boundary=${boundary}`,
    };
}

router.post('/login', (req, res) => {
    const employeeId = typeof req.body?.employeeId === 'string' ? req.body.employeeId.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!employeeIdPattern.test(employeeId) || !/^[a-zA-Z0-9]+$/.test(password)) {
        return res.status(400).json({ error: 'รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = randomBytes(32).toString('hex');
    sessions.set(token, employeeId);
    return res.json({ token, employeeId, email: employeeId, displayName: employeeId });
});

router.post('/logout', (req, res) => {
    const token = getToken(req);
    if (token) sessions.delete(token);
    return res.json({ success: true });
});

router.get('/me', (req, res) => {
    const email = getSessionEmail(req);
    if (!email) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' });
    return res.json({ email });
});

router.get('/posts/images/:fileName', (req, res) => {
    if (!/^[a-f0-9-]{36}\.(jpg|png)$/i.test(req.params.fileName)) {
        return res.sendStatus(404);
    }

    const request = transport.request(
        {
            hostname: backendUrl.hostname,
            port: backendUrl.port || (backendUrl.protocol === 'https:' ? 443 : 80),
            path: `/api/posts/images/${encodeURIComponent(req.params.fileName)}`,
            method: 'GET',
            headers: { host: backendUrl.host },
        },
        (response) => {
            res.status(response.statusCode || 502);
            if (response.headers['content-type']) {
                res.set('content-type', response.headers['content-type']);
            }
            response.pipe(res);
        },
    );

    request.on('error', (error) => {
        console.error('Unable to load post image from backend:', error.message);
        if (res.headersSent) return res.destroy(error);
        return res.status(502).json({ error: 'ไม่สามารถโหลดรูปภาพจาก backend ได้' });
    });
    request.end();
});

router.get('/posts', async (req, res) => {
    const type = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : null;
    if (type && !['lost', 'found'].includes(type)) {
        return res.status(400).json({ error: 'type ต้องเป็น lost หรือ found' });
    }

    try {
        const path = `/api/posts${type ? `?type=${type.toUpperCase()}` : ''}`;
        const result = await sendBackendRequest(path, 'GET');
        if (result.status < 200 || result.status >= 300) {
            return res.status(result.status).type('text/plain').send(result.body);
        }
        const posts = JSON.parse(result.body);
        if (!Array.isArray(posts)) throw new Error('Backend returned an invalid posts response');
        return res.json(posts.map(postToApi));
    } catch (error) {
        console.error('Unable to load posts from backend:', error.message);
        return res.status(502).json({ error: 'ไม่สามารถโหลดโพสต์จาก backend ได้' });
    }
});

router.post('/posts', async (req, res) => {
    const email = getSessionEmail(req);
    if (!email) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนสร้างโพสต์' });

    const { type, desc, place, name, contact, img } = req.body || {};
    if (!['lost', 'found'].includes(type) ||
        typeof desc !== 'string' || !desc.trim() ||
        typeof place !== 'string' || !place.trim() ||
        typeof name !== 'string' || !name.trim() ||
        typeof contact !== 'string' || !contact.trim()) {
        return res.status(400).json({ error: 'กรุณากรอก type, desc, place, name และ contact ให้ครบถ้วน' });
    }

    let image = null;
    if (img !== undefined && img !== null && img !== '') {
        const match = typeof img === 'string'
            ? img.match(/^data:(image\/(?:jpeg|png));base64,([a-zA-Z0-9+/]+={0,2})$/)
            : null;
        if (!match) {
            return res.status(400).json({ error: 'img ต้องเป็นรูป JPG หรือ PNG ในรูปแบบ data URL' });
        }

        const data = Buffer.from(match[2], 'base64');
        if (data.length > 5 * 1024 * 1024) {
            return res.status(400).json({ error: 'รูปภาพต้องมีขนาดไม่เกิน 5 MB' });
        }
        image = {
            contentType: match[1],
            extension: match[1] === 'image/png' ? 'png' : 'jpg',
            data,
        };
    }
    if (type === 'found' && !image) {
        return res.status(400).json({ error: 'กรุณาแนบรูปภาพสำหรับโพสต์ของที่พบ' });
    }

    const backendPost = {
        title: desc.trim().slice(0, 255),
        description: desc.trim(),
        type: type.toUpperCase(),
        location: place.trim(),
        contactName: name.trim(),
        contactInfo: contact.trim(),
        authorEmail: email,
    };
    const multipart = createMultipartPost(backendPost, image);

    try {
        const result = await sendBackendRequest(
            '/api/posts',
            'POST',
            multipart.body,
            multipart.contentType,
        );
        if (result.status < 200 || result.status >= 300) {
            return res.status(result.status).type('text/plain').send(result.body);
        }
        return res.status(201).json(postToApi(JSON.parse(result.body)));
    } catch (error) {
        console.error('Unable to create post in backend:', error.message);
        return res.status(502).json({ error: 'ไม่สามารถบันทึกโพสต์ใน backend ได้' });
    }
});

module.exports = router;
