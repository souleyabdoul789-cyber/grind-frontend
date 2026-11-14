package __APP_PACKAGE__;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.pdf.PdfDocument;
import android.graphics.Typeface;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.UUID;
import java.util.Arrays;
import java.util.Comparator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "GrindMedia")
public class GrindMediaPlugin extends Plugin {
    private static final ExecutorService EXECUTOR = Executors.newFixedThreadPool(2);
    private static final long TEMP_TTL_MS = 30L * 24L * 60L * 60L * 1000L;
    // Quota cache temporaire : les téléchargements permanents ne sont jamais supprimés ici.
    private static final long TEMP_MAX_BYTES = 200L * 1024L * 1024L;
    private static final Object TEMP_CLEANUP_LOCK = new Object();
    // État UI sauvegardé pour masquer les barres uniquement pendant la salle de classe.
    private Integer previousSystemUiVisibility = null;
    private boolean previousFullscreenFlag = false;
    private static final int CONNECT_TIMEOUT_MS = 20000;
    private static final int READ_TIMEOUT_MS = 300000;

    private File externalMediaRoot() {
        File[] roots = getContext().getExternalMediaDirs();
        if (roots != null) {
            for (File root : roots) {
                if (root != null && (root.isDirectory() || root.mkdirs())) return root;
            }
        }
        File fallback = getContext().getExternalFilesDir("media");
        if (fallback != null && (fallback.isDirectory() || fallback.mkdirs())) return fallback;
        return getContext().getCacheDir();
    }

    private File tempDirectory() {
        return new File(externalMediaRoot(), "GRIND/Media/Temporary");
    }

    private File savedDirectory() {
        return new File(externalMediaRoot(), "GRIND DOWNLOAD FILES");
    }

    private String safeName(String input) {
        String name = input == null ? "media" : input.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        if (slash >= 0) name = name.substring(slash + 1);
        name = name.replaceAll("[^\\p{L}\\p{N}._ -]", "_").trim();
        while (name.startsWith(".")) name = name.substring(1);
        if (name.isEmpty()) name = "media";
        if (name.length() > 150) name = name.substring(0, 150);
        return name;
    }

    private void ensureDirectory(File directory, boolean hideFromGallery) throws Exception {
        if (!directory.isDirectory() && !directory.mkdirs()) {
            throw new Exception("Le dossier de stockage GRIND n'est pas accessible.");
        }
        if (hideFromGallery) {
            File noMedia = new File(directory, ".nomedia");
            if (!noMedia.exists()) noMedia.createNewFile();
        }
    }

    private void cleanExpiredTempFiles() {
        synchronized (TEMP_CLEANUP_LOCK) {
            File dir = tempDirectory();
            File[] files = dir.listFiles();
            if (files == null) return;
            long limit = System.currentTimeMillis() - TEMP_TTL_MS;
            long total = 0L;
            for (File file : files) {
                if (!file.isFile() || ".nomedia".equals(file.getName()) || file.getName().endsWith(".part")) continue;
                if (file.lastModified() < limit) {
                    // Les fichiers explicitement enregistrés sont dans un dossier distinct.
                    try { file.delete(); } catch (Exception ignored) { }
                } else {
                    total += file.length();
                }
            }
            // Quota LRU : protège le stockage Android lorsque l'utilisateur parcourt
            // beaucoup de discussions. Les médias les plus récemment consultés restent.
            if (total <= TEMP_MAX_BYTES) return;
            files = dir.listFiles();
            if (files == null) return;
            Arrays.sort(files, Comparator.comparingLong(File::lastModified));
            for (File file : files) {
                if (total <= TEMP_MAX_BYTES) break;
                if (!file.isFile() || ".nomedia".equals(file.getName()) || file.getName().endsWith(".part")) continue;
                long size = file.length();
                if (file.delete()) total = Math.max(0L, total - size);
            }
        }
    }

    private JSObject fileResult(File file, String mimeType, boolean cached) {
        JSObject result = new JSObject();
        result.put("exists", file != null && file.isFile());
        result.put("cached", cached);
        if (file != null && file.isFile()) {
            file.setLastModified(System.currentTimeMillis());
            result.put("path", file.getAbsolutePath());
            result.put("uri", Uri.fromFile(file).toString());
            result.put("fileName", file.getName());
            result.put("mimeType", mimeType == null ? "application/octet-stream" : mimeType);
            result.put("size", file.length());
        }
        return result;
    }

    /**
     * Mode immersif limité à la salle de classe. L'état Android initial est
     * mémorisé puis restauré à la fermeture du composant React.
     */
    @PluginMethod
    public void setImmersiveMode(PluginCall call) {
        final boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled"));
        if (getActivity() == null) {
            call.reject("L'activité Android GRIND n'est pas disponible.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                android.view.Window window = getActivity().getWindow();
                android.view.View decor = window.getDecorView();
                if (enabled) {
                    if (previousSystemUiVisibility == null) {
                        previousSystemUiVisibility = decor.getSystemUiVisibility();
                        previousFullscreenFlag = (window.getAttributes().flags
                            & android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN) != 0;
                    }
                    if (android.os.Build.VERSION.SDK_INT >= 30 && window.getInsetsController() != null) {
                        android.view.WindowInsetsController controller = window.getInsetsController();
                        controller.setSystemBarsBehavior(
                            android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                        );
                        controller.hide(android.view.WindowInsets.Type.systemBars());
                    } else {
                        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN);
                        decor.setSystemUiVisibility(
                            android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                            | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        );
                    }
                } else if (previousSystemUiVisibility != null) {
                    if (android.os.Build.VERSION.SDK_INT >= 30 && window.getInsetsController() != null) {
                        window.getInsetsController().show(android.view.WindowInsets.Type.systemBars());
                    }
                    decor.setSystemUiVisibility(previousSystemUiVisibility);
                    if (previousFullscreenFlag) {
                        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN);
                    } else {
                        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN);
                    }
                    previousSystemUiVisibility = null;
                    previousFullscreenFlag = false;
                }
                // Sans activation préalable réussie, ne touche pas aux barres
                // système : leur état peut appartenir à un autre écran natif.
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("immersive", enabled);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Impossible de modifier l'affichage système Android.", error);
            }
        });
    }

    @PluginMethod
    public void clearClassCache(PluginCall call) {
        try {
            String userKey = safeName(call.getString("userKey", "compte"));
            int classId = call.getInt("classId", -1);
            if (classId <= 0) throw new Exception("Classe invalide.");
            String prefix = "u-" + userKey + "-classe-" + classId + "-message-";
            File[] files = tempDirectory().listFiles();
            int removed = 0;
            if (files != null) {
                for (File file : files) {
                    if (file.isFile() && file.getName().startsWith(prefix)) {
                        if (file.delete()) removed++;
                    }
                }
            }
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("removed", removed);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Le cache temporaire de cette discussion n'a pas pu être vidé.", error);
        }
    }

    @PluginMethod
    public void cleanupExpired(PluginCall call) {
        try {
            cleanExpiredTempFiles();
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("retentionDays", 30);
            result.put("temporaryDirectory", tempDirectory().getAbsolutePath());
            result.put("downloadsDirectory", savedDirectory().getAbsolutePath());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Le nettoyage du stockage local GRIND a échoué.", error);
        }
    }

    @PluginMethod
    public void findCached(PluginCall call) {
        String name = safeName(call.getString("fileName"));
        cleanExpiredTempFiles();
        File file = new File(tempDirectory(), name);
        call.resolve(fileResult(file, call.getString("mimeType"), true));
    }

    @PluginMethod
    public void findSaved(PluginCall call) {
        String name = safeName(call.getString("fileName"));
        File file = new File(savedDirectory(), name);
        call.resolve(fileResult(file, call.getString("mimeType"), true));
    }

    @PluginMethod
    public void saveCached(PluginCall call) {
        try {
            String sourceName = safeName(call.getString("sourceFileName"));
            String targetName = safeName(call.getString("targetFileName", sourceName));
            String mimeType = call.getString("mimeType", "application/octet-stream");
            File source = new File(tempDirectory(), sourceName);
            if (!source.isFile() || source.length() <= 0) {
                throw new Exception("Le fichier temporaire n'est plus disponible.");
            }
            ensureDirectory(savedDirectory(), false);
            File target = new File(savedDirectory(), targetName);
            File partial = new File(savedDirectory(), targetName + ".part");
            try (InputStream input = new BufferedInputStream(new FileInputStream(source));
                 OutputStream output = new BufferedOutputStream(new FileOutputStream(partial, false))) {
                byte[] buffer = new byte[32768];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            }
            if (target.exists() && !target.delete()) throw new Exception("Impossible de remplacer le fichier enregistré.");
            if (!partial.renameTo(target)) throw new Exception("Le fichier n'a pas pu être finalisé dans GRIND DOWNLOAD FILES.");
            target.setLastModified(System.currentTimeMillis());
            call.resolve(fileResult(target, mimeType, false));
        } catch (Exception error) {
            try {
                String targetName = safeName(call.getString("targetFileName", call.getString("sourceFileName", "media")));
                File partial = new File(savedDirectory(), targetName + ".part");
                if (partial.exists()) partial.delete();
            } catch (Exception ignored) { }
            call.reject(error.getMessage() == null ? "Le fichier n'a pas pu être enregistré." : error.getMessage(), error);
        }
    }

    @PluginMethod
    public void downloadToTemp(PluginCall call) {
        download(call, false);
    }

    @PluginMethod
    public void downloadToSaved(PluginCall call) {
        download(call, true);
    }

    private void download(PluginCall call, boolean saved) {
        final String urlText = call.getString("url", "");
        final String fileName = safeName(call.getString("fileName"));
        final String mimeType = call.getString("mimeType", "application/octet-stream");
        final String requestId = call.getString("requestId", UUID.randomUUID().toString());
        final long maxBytes = Math.max(1L, call.getLong("maxBytes", 314572800L));

        EXECUTOR.execute(() -> {
            File folder = saved ? savedDirectory() : tempDirectory();
            File target = new File(folder, fileName);
            File partial = new File(folder, fileName + ".part");
            HttpURLConnection connection = null;
            try {
                ensureDirectory(folder, !saved);
                if (!saved) cleanExpiredTempFiles();
                if (target.isFile() && target.length() > 0) {
                    call.resolve(fileResult(target, mimeType, true));
                    return;
                }
                if (!urlText.startsWith("https://")) {
                    throw new Exception("Adresse de téléchargement non sécurisée.");
                }
                URL source = new URL(urlText);
                if (!"https".equalsIgnoreCase(source.getProtocol()) || source.getUserInfo() != null) {
                    throw new Exception("Adresse de téléchargement non sécurisée.");
                }
                String sourceHost = source.getHost();
                URL current = source;
                int status = 0;
                for (int redirect = 0; redirect <= 3; redirect++) {
                    connection = (HttpURLConnection) current.openConnection();
                    connection.setRequestMethod("GET");
                    connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                    connection.setReadTimeout(READ_TIMEOUT_MS);
                    connection.setInstanceFollowRedirects(false);
                    connection.setRequestProperty("Accept-Encoding", "identity");
                    connection.setRequestProperty("Accept", "*/*");
                    connection.setRequestProperty("User-Agent", "GRIND-Android-Media/2.10.9");
                    status = connection.getResponseCode();
                    if (status != 301 && status != 302 && status != 303 && status != 307 && status != 308) break;
                    String location = connection.getHeaderField("Location");
                    connection.disconnect();
                    connection = null;
                    if (redirect == 3 || location == null || location.trim().isEmpty()) {
                        throw new Exception("Le serveur de fichiers a renvoyé trop de redirections.");
                    }
                    URL destination = new URL(current, location);
                    if (!"https".equalsIgnoreCase(destination.getProtocol())
                            || destination.getUserInfo() != null
                            || !destination.getHost().equalsIgnoreCase(sourceHost)) {
                        throw new Exception("Le serveur de fichiers a redirigé vers une adresse inattendue.");
                    }
                    current = destination;
                }
                String finalHost = current.getHost();
                if (finalHost == null || !finalHost.equalsIgnoreCase(sourceHost)) {
                    throw new Exception("Le serveur de fichiers a redirigé vers une adresse inattendue.");
                }
                if (status < 200 || status >= 300) {
                    throw new Exception(status == 404 ? "Ce fichier n'est plus disponible." : "Le téléchargement a échoué (HTTP " + status + ").");
                }
                long total = connection.getContentLengthLong();
                if (total > maxBytes) throw new Exception("Ce fichier dépasse la limite autorisée.");

                long received = 0;
                byte[] buffer = new byte[32768];
                try (InputStream input = new BufferedInputStream(connection.getInputStream());
                     OutputStream output = new BufferedOutputStream(new FileOutputStream(partial, false))) {
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        received += count;
                        if (received > maxBytes) throw new Exception("Ce fichier dépasse la limite autorisée.");
                        output.write(buffer, 0, count);
                        JSObject progress = new JSObject();
                        progress.put("requestId", requestId);
                        progress.put("received", received);
                        progress.put("total", total);
                        progress.put("percent", total > 0 ? Math.min(99, (int) Math.round(received * 100.0 / total)) : -1);
                        notifyListeners("downloadProgress", progress);
                    }
                }
                if (received <= 0) throw new Exception("Le fichier reçu est vide.");
                if (target.exists() && !target.delete()) throw new Exception("Impossible de remplacer le fichier temporaire.");
                if (!partial.renameTo(target)) {
                    // renameTo peut échouer entre volumes : une copie locale reste atomique au niveau du .part.
                    try (InputStream input = new FileInputStream(partial);
                         OutputStream output = new FileOutputStream(target, false)) {
                        int count;
                        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    }
                    partial.delete();
                }
                JSObject finalProgress = new JSObject();
                finalProgress.put("requestId", requestId);
                finalProgress.put("received", received);
                finalProgress.put("total", total > 0 ? total : received);
                finalProgress.put("percent", 100);
                notifyListeners("downloadProgress", finalProgress);
                if (!saved) cleanExpiredTempFiles();
                call.resolve(fileResult(target, mimeType, false));
            } catch (Exception error) {
                try { if (partial.exists()) partial.delete(); } catch (Exception ignored) { }
                call.reject(error.getMessage() == null ? "Le fichier n'a pas pu être enregistré sur cet appareil." : error.getMessage(), error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        try {
            String path = call.getString("path", "");
            String mimeType = call.getString("mimeType", "application/octet-stream");
            File file = new File(path);
            if (!file.isFile()) throw new Exception("Le fichier local n'est plus disponible.");
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".grindmedia.fileprovider",
                file
            );
            Intent view = new Intent(Intent.ACTION_VIEW);
            view.setDataAndType(uri, mimeType);
            view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            Intent chooser = Intent.createChooser(view, "Ouvrir avec");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(chooser);
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Aucune application ne peut ouvrir ce type de fichier, ou le fichier est indisponible.", error);
        }
    }

    /**
     * Génère et enregistre localement un PDF de feuille/tableau, sans réseau
     * ni Cloudinary. Les pages sont calculées sur le texte complet avec
     * StaticLayout, ce qui conserve les accents, les retours à la ligne et
     * les longs paragraphes sur plusieurs pages A4.
     */
    @PluginMethod
    public void generateTextPdf(PluginCall call) {
        final String rawContent = call.getString("content", "");
        if (rawContent == null || rawContent.trim().isEmpty()) {
            call.reject("Le document est vide.");
            return;
        }
        if (rawContent.length() > 50000) {
            call.reject("Le document dépasse la limite de 50 000 caractères.");
            return;
        }

        String requestedName = safeName(call.getString("fileName", "document-grind.pdf"));
        final String fileName = requestedName.toLowerCase().endsWith(".pdf")
            ? requestedName : requestedName + ".pdf";
        final String title = call.getString("title", "Document de classe GRIND");
        final String subtitle = call.getString("subtitle", "");
        final String className = call.getString("className", "Classe GRIND");
        final String author = call.getString("author", "");

        EXECUTOR.execute(() -> {
            File partial = null;
            PdfDocument document = null;
            try {
                File directory = savedDirectory();
                ensureDirectory(directory, false);
                String baseName = fileName.substring(0, fileName.length() - 4);
                // Chaque export conserve son propre fichier, même si le cours
                // est téléchargé plusieurs fois ou depuis deux vues simultanées.
                String outputName = baseName + "-" + UUID.randomUUID().toString() + ".pdf";
                File target = new File(directory, outputName);
                partial = new File(directory, outputName + ".part");

                final int pageWidth = 595;
                final int pageHeight = 842;
                final int margin = 46;
                final int contentWidth = pageWidth - (margin * 2);
                final int bodyTop = 126;
                final int footerTop = pageHeight - 62;
                final int bodyHeight = footerTop - bodyTop;

                TextPaint bodyPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
                bodyPaint.setColor(Color.rgb(35, 38, 43));
                bodyPaint.setTextSize(11.5f);
                bodyPaint.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));

                StaticLayout layout = StaticLayout.Builder
                    .obtain(rawContent, 0, rawContent.length(), bodyPaint, contentWidth)
                    .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                    .setIncludePad(false)
                    .setLineSpacing(2.5f, 1.12f)
                    .build();

                int pageCount = Math.max(1, (int) Math.ceil(layout.getHeight() / (double) bodyHeight));
                document = new PdfDocument();

                Paint titlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
                titlePaint.setColor(Color.rgb(35, 38, 43));
                titlePaint.setTextSize(19f);
                titlePaint.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));

                Paint metaPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
                metaPaint.setColor(Color.rgb(95, 101, 111));
                metaPaint.setTextSize(8.5f);
                metaPaint.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));

                Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
                linePaint.setColor(Color.rgb(214, 218, 224));
                linePaint.setStrokeWidth(1f);

                Paint footerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
                footerPaint.setColor(Color.rgb(112, 119, 129));
                footerPaint.setTextSize(8f);

                for (int pageNumber = 0; pageNumber < pageCount; pageNumber++) {
                    PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(
                        pageWidth, pageHeight, pageNumber + 1
                    ).create();
                    PdfDocument.Page page = document.startPage(pageInfo);
                    Canvas canvas = page.getCanvas();
                    canvas.drawColor(Color.WHITE);
                    canvas.drawText(title, margin, 53f, titlePaint);
                    String metadata = className + " · " + author;
                    canvas.drawText(metadata.length() > 92 ? metadata.substring(0, 89) + "…" : metadata,
                        margin, 75f, metaPaint);
                    canvas.drawText(subtitle.length() > 105 ? subtitle.substring(0, 102) + "…" : subtitle,
                        margin, 91f, metaPaint);
                    canvas.drawLine(margin, 105f, pageWidth - margin, 105f, linePaint);

                    int verticalOffset = pageNumber * bodyHeight;
                    canvas.save();
                    canvas.translate(margin, bodyTop - verticalOffset);
                    canvas.clipRect(0, verticalOffset, contentWidth, verticalOffset + bodyHeight);
                    layout.draw(canvas);
                    canvas.restore();

                    canvas.drawLine(margin, footerTop + 15f, pageWidth - margin, footerTop + 15f, linePaint);
                    canvas.drawText("GRIND · Document de classe", margin, pageHeight - 27f, footerPaint);
                    String pageLabel = "Page " + (pageNumber + 1) + " / " + pageCount;
                    canvas.drawText(pageLabel, pageWidth - margin - footerPaint.measureText(pageLabel), pageHeight - 27f, footerPaint);
                    document.finishPage(page);
                }

                try (OutputStream output = new BufferedOutputStream(new FileOutputStream(partial, false))) {
                    document.writeTo(output);
                }
                document.close();
                document = null;

                if (target.exists()) {
                    throw new Exception("Un fichier portant déjà ce nom existe ; relance le téléchargement.");
                }
                if (!partial.renameTo(target)) {
                    throw new Exception("Le PDF n'a pas pu être finalisé dans GRIND DOWNLOAD FILES.");
                }
                JSObject result = fileResult(target, "application/pdf", false);
                result.put("success", true);
                result.put("directory", directory.getAbsolutePath());
                call.resolve(result);
            } catch (Exception error) {
                if (document != null) {
                    try { document.close(); } catch (Exception ignored) { }
                }
                try { if (partial != null && partial.exists()) partial.delete(); } catch (Exception ignored) { }
                call.reject(error.getMessage() == null
                    ? "Le PDF n'a pas pu être enregistré sur cet appareil."
                    : error.getMessage(), error);
            }
        });
    }

}
