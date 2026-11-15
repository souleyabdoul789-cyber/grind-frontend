package __APP_PACKAGE__;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.database.Cursor;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Export des feuilles et du tableau de classe dans le dossier public
 * Download/GRIND DOWNLOAD FILES sur Android 10+.
 *
 * MediaStore.Downloads est utilisé pour respecter le stockage cloisonné
 * Android : aucune permission MANAGE_EXTERNAL_STORAGE n'est nécessaire.
 */
@CapacitorPlugin(name = "GrindDownloads")
public class GrindDownloadsPlugin extends Plugin {
    private static final ExecutorService EXECUTOR = Executors.newFixedThreadPool(2);
    private static final String MIME_PDF = "application/pdf";
    private static final String DOSSIER_GRIND = "GRIND DOWNLOAD FILES";

    private String safeName(String input) {
        String name = input == null ? "document-grind" : input.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        if (slash >= 0) name = name.substring(slash + 1);
        name = name.replaceAll("[^\\p{L}\\p{N}._ -]", "_").trim();
        while (name.startsWith(".")) name = name.substring(1);
        if (name.isEmpty()) name = "document-grind";
        if (name.length() > 110) name = name.substring(0, 110);
        return name;
    }

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
        final String baseName = requestedName.toLowerCase().endsWith(".pdf")
            ? requestedName.substring(0, requestedName.length() - 4)
            : requestedName;
        final String title = call.getString("title", "Document de classe GRIND");
        final String subtitle = call.getString("subtitle", "");
        final String className = call.getString("className", "Classe GRIND");
        final String author = call.getString("author", "");
        final String outputName = baseName + "-" + UUID.randomUUID().toString().substring(0, 8) + ".pdf";

        EXECUTOR.execute(() -> {
            PdfDocument document = null;
            Uri savedUri = null;
            File legacyFile = null;
            try {
                OutputStream rawOutput;
                String directoryLabel;
                boolean useMediaStore = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q;

                if (useMediaStore) {
                    ContentResolver resolver = getContext().getContentResolver();
                    ContentValues metadata = new ContentValues();
                    metadata.put(MediaStore.MediaColumns.DISPLAY_NAME, outputName);
                    metadata.put(MediaStore.MediaColumns.MIME_TYPE, MIME_PDF);
                    metadata.put(
                        MediaStore.MediaColumns.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/" + DOSSIER_GRIND
                    );
                    metadata.put(MediaStore.MediaColumns.IS_PENDING, 1);
                    savedUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, metadata);
                    if (savedUri == null) {
                        throw new Exception("Android n'a pas pu créer le fichier dans Téléchargements/" + DOSSIER_GRIND + ".");
                    }
                    rawOutput = resolver.openOutputStream(savedUri, "w");
                    if (rawOutput == null) {
                        throw new Exception("Android n'a pas ouvert le fichier PDF pour l'écriture.");
                    }
                    directoryLabel = "Download/" + DOSSIER_GRIND;
                } else {
                    // Android 8 et 9 : stockage externe propre à l'application.
                    // À partir d'Android 10, le dossier public est géré par MediaStore.
                    File downloads = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (downloads == null) {
                        throw new Exception("Le stockage externe de l'appareil n'est pas disponible.");
                    }
                    File directory = new File(downloads, DOSSIER_GRIND);
                    if (!directory.isDirectory() && !directory.mkdirs()) {
                        throw new Exception("Le dossier GRIND de téléchargement n'a pas pu être créé.");
                    }
                    legacyFile = new File(directory, outputName);
                    rawOutput = new FileOutputStream(legacyFile, false);
                    directoryLabel = directory.getAbsolutePath();
                }

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
                    canvas.drawText(
                        metadata.length() > 92 ? metadata.substring(0, 89) + "…" : metadata,
                        margin, 75f, metaPaint
                    );
                    canvas.drawText(
                        subtitle.length() > 105 ? subtitle.substring(0, 102) + "…" : subtitle,
                        margin, 91f, metaPaint
                    );
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
                    canvas.drawText(
                        pageLabel,
                        pageWidth - margin - footerPaint.measureText(pageLabel),
                        pageHeight - 27f,
                        footerPaint
                    );
                    document.finishPage(page);
                }

                try (OutputStream output = new BufferedOutputStream(rawOutput)) {
                    document.writeTo(output);
                    output.flush();
                }
                document.close();
                document = null;

                if (useMediaStore) {
                    ContentValues publish = new ContentValues();
                    publish.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    int rows = getContext().getContentResolver().update(savedUri, publish, null, null);
                    if (rows <= 0) {
                        throw new Exception("Le PDF a été écrit, mais Android n'a pas pu le publier dans Téléchargements.");
                    }
                } else if (legacyFile == null || !legacyFile.isFile() || legacyFile.length() <= 0) {
                    throw new Exception("Le PDF n'a pas pu être finalisé dans le dossier GRIND.");
                }

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("exists", true);
                result.put("cached", false);
                result.put("fileName", outputName);
                result.put("mimeType", MIME_PDF);
                result.put("directory", directoryLabel);
                if (savedUri != null) {
                    result.put("uri", savedUri.toString());
                    try (Cursor cursor = getContext().getContentResolver().query(
                        savedUri,
                        new String[] { MediaStore.MediaColumns.SIZE },
                        null, null, null
                    )) {
                        if (cursor != null && cursor.moveToFirst()) {
                            int sizeColumn = cursor.getColumnIndex(MediaStore.MediaColumns.SIZE);
                            if (sizeColumn >= 0) result.put("size", cursor.getLong(sizeColumn));
                        }
                    }
                } else if (legacyFile != null) {
                    result.put("path", legacyFile.getAbsolutePath());
                    result.put("size", legacyFile.length());
                }
                call.resolve(result);
            } catch (Exception error) {
                if (document != null) {
                    try { document.close(); } catch (Exception ignored) { }
                }
                if (savedUri != null) {
                    try { getContext().getContentResolver().delete(savedUri, null, null); } catch (Exception ignored) { }
                }
                if (legacyFile != null && legacyFile.exists()) {
                    try { legacyFile.delete(); } catch (Exception ignored) { }
                }
                call.reject(
                    error.getMessage() == null
                        ? "Le PDF n'a pas pu être enregistré dans Téléchargements/" + DOSSIER_GRIND + "."
                        : error.getMessage(),
                    error
                );
            }
        });
    }
}
