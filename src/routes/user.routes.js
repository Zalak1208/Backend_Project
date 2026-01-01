import { Router } from "express";
import {changeCurrentPassword, getCurrentUser, getUserChannelProfile, getWatchHistory, loginUser, logOutUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar, updateUsercoverImage} from "../controllers/user.controllers.js";
import {upload} from '../middlewares/multer.middlewares.js'
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1,
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)

// secured Routes
router.route("/logout").post(verifyJWT, logOutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)  // here we are not sending any data, we directly get the user so get is used
router.route("/update-account").patch(verifyJWT, updateAccountDetails) // here we want to update only some details not the whole so patch is used
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar )
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUsercoverImage)
router.route("/c/:username").get(verifyJWT, getUserChannelProfile) // data from params(url)
router.route("/history").get(verifyJWT, getWatchHistory)

export default router