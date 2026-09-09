const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { createReimbursementSchema } = require("../validators/reimbursement.validator");
const { uploadReimbursementAttachments } = require("../config/reimbursementAttachmentUpload");
const controller = require("../controllers/reimbursement.controller");
const { USER_TYPE } = require("../utils/constants");

const router = express.Router();

// Anyone with an account files their own claims - employees, managers and
// admins alike (an admin/manager claim routes to their own manager, or to
// other admins if they have none). Rejection reason is enforced in the
// service; approve/reject themselves live on the manager + admin routers.
router.use(authenticate, authorize(USER_TYPE.EMPLOYEE, USER_TYPE.MANAGER, USER_TYPE.ADMIN));

router.get("/", controller.listMine);
router.post("/", uploadReimbursementAttachments, validate(createReimbursementSchema), controller.create);
router.get("/:id", controller.getMine);
router.patch("/:id/cancel", controller.cancel);
router.get("/:id/attachments/:attachmentId", controller.getMyAttachment);

module.exports = router;
