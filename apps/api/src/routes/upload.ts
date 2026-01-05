import { Hono } from 'hono';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { db } from '../db';

const uploadRouter = new Hono();

// All routes require authentication
uploadRouter.use('*', authMiddleware);

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

// Upload promotion banner
uploadRouter.post('/promotion-image', requirePermission('promotions:create'), async (c) => {
  try {
    const user = c.get('user');
    const storeId = c.req.query('storeId') || user.storeId;

    if (!storeId) {
      return c.json({ success: false, error: 'Store ID is required' }, 400);
    }

    if (user.role !== 'admin' && storeId !== user.storeId) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Get the file from the form
    const formData = await c.req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return c.json({ success: false, error: 'No image provided' }, 400);
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({ 
        success: false, 
        error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` 
      }, 400);
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return c.json({ 
        success: false, 
        error: 'File too large. Maximum size is 2MB' 
      }, 400);
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${uuid()}.${ext}`;
    const uploadDir = './uploads/promotions';
    const filepath = `${uploadDir}/${filename}`;

    // Ensure upload directory exists
    await mkdir(uploadDir, { recursive: true });

    // Convert file to buffer and write
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // In production, you would write to S3 or cloud storage
    // For now, we'll return a mock URL
    // In production: await writeFile(filepath, buffer);
    
    // Return the URL
    // In production: const url = `/uploads/promotions/${filename}`;
    // For now, we'll simulate an upload by returning a data URL
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    return c.json({
      success: true,
      data: {
        url: dataUrl, // In production, use: url
        filename,
        originalName: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ success: false, error: 'Failed to upload image' }, 500);
  }
});

export default uploadRouter;
