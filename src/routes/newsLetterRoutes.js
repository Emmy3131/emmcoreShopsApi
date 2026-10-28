const express = require('express');
const router = express.Router();
const newsletterController = require('../controllers/newsLetterController');

router.post('/subscribe', newsletterController.subscribeNewsletter);
router.get('/subscribers', newsletterController.getAllSubscribers);
router.delete('/subscribers/:id', newsletterController.deleteSubscriber);
router.get('/subscribers/count', newsletterController.getSubscriberCount);

module.exports = router;