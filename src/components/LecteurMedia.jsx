import { creerPosterVideoCloudinary } from "../mediaPresentation.js";

export default function LecteurMedia({ url, type }) {
  if (type === "image") {
    return <div className="cadre-media"><img src={url} alt="" loading="lazy" /></div>;
  }
  if (type === "video") {
    const poster = creerPosterVideoCloudinary(url);
    return (
      <div className="cadre-media cadre-video">
        <video src={url} poster={poster || undefined} controls playsInline preload="metadata"
          aria-label="Lecteur vidéo de la publication" />
      </div>
    );
  }
  return null;
}
