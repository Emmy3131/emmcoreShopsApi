const express = require("express");
const router = express.Router();

const PageController = require("../controllers/pageController");
const authController = require("../controllers/authController");

/* ================= ADMIN CREATE PAGE ================= */
router
  .route("/")
  .post(
    authController.protect,
    authController.restrictTo("admin"),
    PageController.createPage,
  )
  .get(PageController.getPages);

/* ================= PUBLIC PUBLISHED PAGES ================= */
router.get("/published", PageController.getPublishedPages);

/* ================= GET PAGE BY SLUG (FRONTEND) ================= */
router.get("/slug/:slug", PageController.getPageBySlug);

/* ================= GET / UPDATE / DELETE BY ID ================= */
router
  .route("/:id")
  .get(PageController.getPageById)
  .patch(
    authController.protect,
    authController.restrictTo("admin"),
    PageController.updatePage,
  )
  .delete(
    authController.protect,
    authController.restrictTo("admin"),
    PageController.deletePage,
  );

router.get(
  "/preview/:slug",
  authController.protect,
  authController.restrictTo("admin"),
  PageController.previewPage,
);

module.exports = router;
