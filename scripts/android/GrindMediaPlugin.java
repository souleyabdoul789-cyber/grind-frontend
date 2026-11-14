package __APP_PACKAGE__;

import android.content.Context;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "GrindMedia")
public class GrindMediaPlugin extends Plugin {
    private static final ExecutorService EXECUTOR = Executors.newFixedThreadPool(2);
    private static final long TEMP_TTL_MS = 30L * 24L * 60L * 60L * 1000L;
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
        File dir = tempDirectory();
        File[] files = dir.listFiles();
        if (files == null) return;
        long limit = System.currentTimeMillis() - TEMP_TTL_MS;
        for (File file : files) {
            if (file.isFile() && !".nomedia".equals(file.getName()) && file.lastModified() < limit) {
                // Les fichiers explicitement enregistrés sont dans un dossier distinct.
                // Seul le cache temporaire de discussion est soumis à l'expiration.
                try { file.delete(); } catch (Exception ignored) { }
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
                String sourceHost = source.getHost();
                connection = (HttpURLConnection) source.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(READ_TIMEOUT_MS);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("Accept-Encoding", "identity");
                connection.setRequestProperty("Accept", "*/*");
                connection.setRequestProperty("User-Agent", "GRIND-Android-Media/2.10.6");
                int status = connection.getResponseCode();
                String finalHost = connection.getURL().getHost();
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
}
