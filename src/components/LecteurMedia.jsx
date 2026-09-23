import { useRef, useEffect, useState } from "react";

export default function LecteurMedia({ url, type }) {
  const videoRef = useRef(null);
  const conteneurRef = useRef(null);
  const [sonActif, setSonActif] = useState(false);
  const [enLecture, setEnLecture] = useState(false);

  useEffect(() => {
    if (type !== "video") return;
    const video = videoRef.current;
    if (!video) return;

    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          video.play().then(() => setEnLecture(true)).catch(() => {});
        } else {
          video.pause();
          setEnLecture(false);
        }
      },
      { threshold: 0.6 }
    );

    observateur.observe(conteneurRef.current);
    return () => observateur.disconnect();
  }, [type]);

  function basculerSon() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = sonActif; // on inverse
    setSonActif(!sonActif);
  }

  if (type === "image") {
    return (
      <div className="cadre-media">
        <img src={url} alt="" loading="lazy" />
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="cadre-media cadre-video" ref={conteneurRef} onClick={basculerSon}>
        <video ref={videoRef} src={url} muted loop playsInline preload="metadata" />
        <div className="controle-son">
          <i className={sonActif ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark"}></i>
        </div>
        {!enLecture && (
          <div className="voile-video">
            <i className="fa-solid fa-play"></i>
          </div>
        )}
      </div>
    );
  }

  return null;
}
