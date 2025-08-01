import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const router = express.Router();

const apiKey = process.env.IMAGEAPI;
const apiUrl = process.env.IMAGEHOST;

const storage = multer.memoryStorage();
const uload = multer({ storage: storage });


router.post('/upload', uload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const form = new FormData();
        form.append('key', apiKey);
        form.append('action', 'upload');
        form.append('format', 'json');
        form.append('source', req.file.buffer, req.file.originalname);

        const response = await axios.post(apiUrl, form, {
            headers: {
                ...form.getHeaders(),
            },
        });

        if (response.status === 200) {
            const data = response.data;
            if (data.image && data.image.url) {
                res.status(200).json({
                    message: 'Image uploaded successfully!',
                    imageUrl: data.image.url,
                });
            } else {
                res.status(500).json({ error: 'Unexpected response structure', data });
            }
        } else {
            res.status(response.status).json({ error: 'Error uploading image', message: response.data });
        }
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'An error occurred during the image upload', message: error.message });
    }
});

export default router;