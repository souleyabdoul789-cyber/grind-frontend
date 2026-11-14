/** Construit un poster JPG pour une vidéo hébergée sur le Cloudinary GRIND. */
export function creerPosterVideoCloudinary(source) {
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const videoIndex = parts.findIndex((part, index) => part === "video" && parts[index + 1] === "upload");
    if (videoIndex < 1) return null;
    const uploadIndex = videoIndex + 1;
    const versionIndex = parts.findIndex((part, index) => index > uploadIndex && /^v\d+$/.test(part));
    if (versionIndex < 0 || versionIndex >= parts.length - 1) return null;
    const transformations = parts.slice(uploadIndex + 1, versionIndex);
    if (!transformations.some(part => /(?:^|,)so_[^,]+/.test(part))) transformations.unshift("so_0");
    const file = parts[parts.length - 1];
    const stem = file.includes(".") ? file.slice(0, file.lastIndexOf(".")) : file;
    if (!stem) return null;
    const posterParts = [
      ...parts.slice(0, uploadIndex + 1),
      ...transformations,
      ...parts.slice(versionIndex, -1),
      `${stem}.jpg`,
    ];
    url.pathname = `/${posterParts.join("/")}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch { return null; }
}
