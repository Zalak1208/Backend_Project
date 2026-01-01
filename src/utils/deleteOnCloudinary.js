import { v2 as cloudinary } from "cloudinary"
import { ApiError } from "./apiErrors.js"

const deleteFromCloudinary = async(publicId) => {
    try{
        if(!publicId){
            throw new ApiError(400, "Cloudinary public_id is required for deletion")  
        }

        const deleteAvatar = await cloudinary.uploader.destroy(publicId);

        // here {deleteAvatar : "ok"} or {deleteAvatar : "not found"}

        if(deleteAvatar !== "ok"){
            throw new ApiError(404, `Cloudinary asset not found or already deleted: ${publicId}`);
        }
        return deleteAvatar;

    }catch(error){
        throw new ApiError(500, error?.message || "Cloudinary delete error")
    }
}

export { deleteFromCloudinary };