import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// GET to preview, POST to execute
router.post('/user-email-index', async (req, res) => {
	try {
		const db = mongoose.connection.db;
		const collection = db.collection('users');

		// List current indexes
		const indexes = await collection.indexes();

		// Drop legacy flat email index if exists (email_1)
		const hasLegacyEmailIndex = indexes.some((idx) => idx.name === 'email_1');
		if (hasLegacyEmailIndex) {
			await collection.dropIndex('email_1');
		}

		// Ensure correct nested index exists: unique + sparse on personalInfo.email
		const hasNestedIndex = indexes.some((idx) => idx.name === 'personalInfo.email_1');
		if (!hasNestedIndex) {
			await collection.createIndex({ 'personalInfo.email': 1 }, { unique: true, sparse: true, name: 'personalInfo.email_1' });
		}

		return res.json({
			success: true,
			message: 'User email index migration complete',
			droppedLegacy: hasLegacyEmailIndex,
			ensuredNestedUniqueSparse: true,
		});
	} catch (err) {
		console.error('Migration error:', err);
		return res.status(500).json({ success: false, message: 'Migration failed', error: err.message });
	}
});

export default router;
