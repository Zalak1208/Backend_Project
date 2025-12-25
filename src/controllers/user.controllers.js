import { DB_NAME } from "../constants.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiErrors.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js";

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
  const { username, email, password, fullname } = req.body;
  //console.log(req.body) ---> object with all data
  
  // Validation
    // check for all the fields
    //   if(fullname === ""){
    //     throw new ApiError(400 , "FullName is required")
    //   }
    
    //another way

    if(
        [fullname, email, username, password].some((field) => 
            field?.trim() === ""
        )
    ){
        throw new ApiError(400 , "all fields are required")
    }
// same user alredy exists?

    const existedUser =  await User.findOne({
        $or:[{username}, {email}]
    })
    if(existedUser){
        throw new ApiError(409, "User with username or email already exists")
    }
    //console.log(existedUser); ---> null if user is unique

// Halndling images

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path
    //console.log(req.files) //---> undefined if no file is given

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }
// upload them to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

// check if user created successfully and remove password and refreshToken fields    

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500 , "Something wemt wrong while registering the user" )
    }

// Sending API Response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

});

export { registerUser };
