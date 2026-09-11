// server/src/controllers/offer.controller.js
const Offer = require('../models/Offer');
const cloudinary = require('../config/cloudinary');

/**
 * Member/Public: Get every currently active offer, for the Dashboard
 * offer slider. Sorted by admin-chosen `order`, newest first as a tiebreak.
 * GET /api/offers
 */
const getActiveOffers = async (req, res, next) => {
  try {
    const offers = await Offer.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .select('title imageUrl linkUrl order')
      .lean();

    res.json({ success: true, data: { offers } });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get every offer (active + inactive), for the management list.
 * GET /api/admin/offers
 */
const getAllOffersAdmin = async (req, res, next) => {
  try {
    const offers = await Offer.find().sort({ order: 1, createdAt: -1 }).lean();
    res.json({ success: true, data: { offers } });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new offer. Expects multipart/form-data with an `image`
 * file field (see offer.routes.js's multer wiring) plus title/linkUrl/order
 * text fields — same upload-to-Cloudinary shape as
 * user.controller.js#uploadProfilePhoto.
 * POST /api/admin/offers
 */
const createOffer = async (req, res, next) => {
  try {
    const { title, linkUrl, order, isActive } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Offer title is required.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'An offer image is required.' });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'kuwifr/offers',
          transformation: [{ width: 1200, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }]
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const offer = await Offer.create({
      title: title.trim(),
      imageUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      linkUrl: (linkUrl || '').trim(),
      order: Number(order) || 0,
      isActive: isActive === undefined ? true : isActive === 'true' || isActive === true,
      createdBy: req.userId || req.user?.id || req.user?._id
    });

    res.status(201).json({ success: true, message: 'Offer created and added to the Dashboard slider.', data: { offer } });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update an offer's title/link/order/active state, and optionally
 * replace its image (old Cloudinary asset is destroyed on replace).
 * PUT /api/admin/offers/:id
 */
const updateOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found.' });
    }

    const { title, linkUrl, order, isActive } = req.body;
    if (title !== undefined) offer.title = title.trim();
    if (linkUrl !== undefined) offer.linkUrl = linkUrl.trim();
    if (order !== undefined) offer.order = Number(order) || 0;
    if (isActive !== undefined) offer.isActive = isActive === 'true' || isActive === true;

    if (req.file) {
      if (offer.publicId) {
        await cloudinary.uploader.destroy(offer.publicId).catch(() => {});
      }
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'kuwifr/offers',
            transformation: [{ width: 1200, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }]
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      offer.imageUrl = uploadResult.secure_url;
      offer.publicId = uploadResult.public_id;
    }

    await offer.save();
    res.json({ success: true, message: 'Offer updated.', data: { offer } });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete an offer (and its Cloudinary asset).
 * DELETE /api/admin/offers/:id
 */
const deleteOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found.' });
    }

    if (offer.publicId) {
      await cloudinary.uploader.destroy(offer.publicId).catch(() => {});
    }
    await offer.deleteOne();

    res.json({ success: true, message: 'Offer removed from the Dashboard slider.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveOffers,
  getAllOffersAdmin,
  createOffer,
  updateOffer,
  deleteOffer
};