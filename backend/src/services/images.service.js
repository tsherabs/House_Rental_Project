import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { transaction } from '../db/pool.js';
import { PUBLIC_PROPERTY } from '../db/queries.js';
import { lockOwnedProperty } from './properties.service.js';
import { ApiError, conflict, notFound } from '../utils/errors.js';
const imageDto = (i) => ({ id: i.id, url: `/api/v1/property-images/${i.id}`, displayOrder: i.display_order });
export async function listImages(db, id) {
  return (await db.query('SELECT id,display_order FROM property_images WHERE property_id=$1 ORDER BY display_order,id', [id])).rows.map(imageDto);
}
export async function canonicalImage(buffer) {
  let format;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) format = 'jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) format = 'png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') format = 'webp';
  if (!format) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only valid JPEG, PNG or WebP images are allowed');
  try {
    // Decode and re-encode: reject broken images and strip metadata/trailing data.
    const pipeline = sharp(buffer, { limitInputPixels: 25000000, failOn: 'warning', animated: false });
    const metadata = await pipeline.metadata();
    if (metadata.format !== format || (metadata.pages ?? 1) > 1) throw new Error('Invalid or animated image');
    return { buffer: await pipeline.rotate().toFormat(format).toBuffer(), mime: `image/${format}`, extension: format === 'jpeg' ? 'jpg' : format };
  } catch {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Image cannot be safely decoded');
  }
}
export function imagesService(pool, config, logger) {
  const filePath = (key) => {
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) throw notFound();
    return path.join(config.uploadDir, key);
  };
  const cleanup = async (keys) => {
    for (const key of keys) {
      try { await unlink(filePath(key)); }
      catch (error) { if (error.code !== 'ENOENT') logger.error({ event: 'image_cleanup_failed', errorType: error.name }); }
    }
  };
  return {
    async upload(id, ownerId, files) {
      if (!files?.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Provide at least one image');
      const encoded = [];
      for (const file of files) {
        const image = await canonicalImage(file.buffer);
        if (image.buffer.length > config.maxUploadBytes) throw new ApiError(413, 'FILE_TOO_LARGE', 'Encoded image exceeds upload limit');
        encoded.push(image);
      }
      await mkdir(config.uploadDir, { recursive: true, mode: 0o700 });
      const written = [];
      try {
        return await transaction(pool, async (db) => {
          await lockOwnedProperty(db, id, ownerId);
          const { rows: [count] } = await db.query('SELECT count(*)::int AS total FROM property_images WHERE property_id=$1', [id]);
          if (count.total + encoded.length > config.maxPropertyImages) throw conflict(`A property may have at most ${config.maxPropertyImages} images`);
          for (let index = 0; index < encoded.length; index++) {
            const image = encoded[index];
            const key = `${randomUUID()}.${image.extension}`;
            written.push(key);
            await writeFile(filePath(key), image.buffer, { flag: 'wx', mode: 0o600 });
            await db.query('INSERT INTO property_images(property_id,storage_key,mime_type,display_order) VALUES($1,$2,$3,$4)', [id, key, image.mime, count.total + index]);
          }
          return listImages(db, id);
        });
      } catch (error) { await cleanup(written); throw error; }
    },
    async remove(id, imageId, ownerId) {
      const key = await transaction(pool, async (db) => {
        await lockOwnedProperty(db, id, ownerId);
        const { rows: [image] } = await db.query('DELETE FROM property_images WHERE id=$1 AND property_id=$2 RETURNING storage_key', [imageId, id]);
        if (!image) throw notFound();
        await db.query(`WITH ordered AS (SELECT id,row_number() OVER(ORDER BY display_order,id)-1 AS position FROM property_images WHERE property_id=$1)
          UPDATE property_images SET display_order=ordered.position FROM ordered WHERE property_images.id=ordered.id`, [id]);
        return image.storage_key;
      });
      // After commit, stale files are inaccessible even if disk cleanup fails.
      await cleanup([key]);
    },
    async order(id, ownerId, ids) {
      return transaction(pool, async (db) => {
        await lockOwnedProperty(db, id, ownerId);
        const images = await listImages(db, id);
        if (ids.length !== images.length || new Set(ids).size !== ids.length || images.some((i) => !ids.includes(i.id))) throw new ApiError(400, 'VALIDATION_ERROR', 'imageIds must be the exact image set without duplicates');
        for (let index = 0; index < ids.length; index++) await db.query('UPDATE property_images SET display_order=$2 WHERE id=$1', [ids[index], index]);
        return listImages(db, id);
      });
    },
    async read(imageId, userId) {
      const { rows: [image] } = await pool.query(`SELECT i.storage_key,i.mime_type FROM property_images i
        JOIN properties p ON p.id=i.property_id JOIN users u ON u.id=p.owner_id
        WHERE i.id=$1 AND ((${PUBLIC_PROPERTY}) OR (p.owner_id=$2 AND u.role='landlord' AND u.account_status='active'))`, [imageId, userId ?? null]);
      if (!image) throw notFound();
      return { path: filePath(image.storage_key), mime: image.mime_type };
    },
  };
}
