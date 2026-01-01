import { DB_NAME } from "../constants.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiErrors.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import { getCloudinaryPublicId } from "../utils/getCloudinaryPublicId";
import { deleteFromCloudinary } from "../utils/deleteOnCloudinary.js";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken; // storing refreshtoken in database
    await user.save({ validateBeforeSave: false }); // when we try to save the user it checks all the parameters, eg. password, but here we are just adding one value, so we turned the validation false to stop these validation

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Somethimg went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // logic building of registration :
  // 1. take user details from frontend (postman)
  // 2. validate the data (non-empty)
  // 3. check if user alredy exists , via email and username
  // 4. check for images , avatar
  // 5. upload the images and avatar on cloudinary
  // 6. create user object - data entry in db
  // 7. remove password and refresh token field from response
  // 8. check if user successfully created or Not
  // 9. return response if user created successfully or return error

  // taking data
  const { username, email, password, fullname } = req.body || {};
  //console.log(req.body) ---> object with all data

  // Validation
  // check for all the fields
  //   if(fullname === ""){
  //     throw new ApiError(400 , "FullName is required")
  //   }

  //another way

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "all fields are required");
  }
  // same user alredy exists?

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "User with username or email already exists");
  }
  //console.log(existedUser); ---> null if user is unique

  // Halndling images

  const avatarLocalPath = req.files?.avatar[0]?.path;
  //const coverImageLocalPath = req.files?.coverImage[0]?.path
  //console.log(req.files) //---> undefined if no file is given

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // upload them to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // check if user created successfully and remove password and refreshToken fields

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something wemt wrong while registering the user");
  }

  // Sending API Response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // take data from req.body
  // login on the base of email or username
  // find the user
  // check the password
  // generate acess and refresh token
  // send these tokens via cookies

  const { email, username, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid User Credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged In Successfully"
      )
    );
});

const logOutUser = asyncHandler(async (req, res) => {
  // logout only work for logged-in users
  // remove refresh token from database
  // clear the cookies from browser
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token is Expired or Used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access Token Refreshed Successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid oldpassword");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(200, req.user, "Currect User Fetched Successfully");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname && !email) {
    throw new ApiError(401, "All fields are required");
  }

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Details Updated Successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is Missing");
  }

  const user = await User.findById(req.user._id).select("-password");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const Avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!Avatar) {
    throw new ApiError(500, "Error while uploading Avatar");
  }

  if (user.avatar) {
    const oldAvatarPublicId = getCloudinaryPublicId(user.avatar);
    await deleteFromCloudinary(oldAvatarPublicId);
  }

  user.avatar = Avatar.url;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar Updated Successfully"));
});

const updateUsercoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "coverImage file is Missing");
  }

  const user = await User.findById(req.user._id).select("-password");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage) {
    throw new ApiError(500, "Error while uploading coverImage");
  }

  if (user.coverImage) {
    const oldcoverImagePublicId = getCloudinaryPublicId(user.coverImage);
    await deleteFromCloudinary(oldcoverImagePublicId);
  }

  user.coverImage = coverImage.url;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, user, "coverImage Updated Successfully"));
});

const getUserChannelProfile = asyncHandler(async(req, res) => {
  const { username } = req.params; // from url

  if(!username?.trim()){
    throw new ApiError(400, "Username is Missing")
  }
  
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()  // finds the document in db with the given username
      }
    },
    {
      $lookup:{
        from: "subscriptions", // in DB Subscription ---> subscriptions
        localField: "_id",
        foreignField: "channel",  // i want subscribers so i will check channel field
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subcriptions",
        localField: "_id",
        foreignField: "subscriber", // for findind that whom do i subscribed select subscriber 
        as: "subscribedTo"
      }
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers"
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo"
        },
        isSubscribed: {
          $cond: {
            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project: { // give selected things
         fullname: 1,
         username: 1,
         subscribersCount: 1,
         channelSubscribedToCount: 1,
         isSubscribed: 1,
         avatar: 1,
         coverImage: 1,
         email: 1
      }
    }
  ])
  if(!channel?.length()){
    throw new ApiError(404, "Channel does not Exist.")
  }

  // pipeline return array of objects

  return res.status(200).json(
    new ApiResponse(200, channel[0], "User Channel Fetched Successfully.")
  )
});

const getWatchHistory = asyncHandler(async(req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)  // req.user._id gives string
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as : "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar : 1
                  }
                }
              ]
            }
          },
          {
            $addFields:{
              owner: { 
                $first: "$owner"   // now instaed of array I will get first object in output
              }
            }
          }
        ]
      }
    }
  ])

  return res.status(200).json(new ApiResponse(200, user[0].WatchHistory, "Watch History fetched Successfully"))
});


export {
  registerUser,
  loginUser,
  logOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUsercoverImage,  
  updateUserAvatar,
  getUserChannelProfile,
  getWatchHistory
};
