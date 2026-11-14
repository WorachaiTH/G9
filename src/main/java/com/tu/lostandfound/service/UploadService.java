package com.tu.lostandfound.service;

import com.tu.lostandfound.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class UploadService {

    private static final Path UPLOAD_PATH = Paths.get("uploads");
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final int MAX_IMAGES = 5;
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "image/jpeg", ".jpg",
            "image/jpg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    public List<MultipartFile> validate(MultipartFile[] images) {
        return validate(images, MAX_IMAGES);
    }

    public List<MultipartFile> validate(MultipartFile[] images, int maxImages) {
        List<MultipartFile> validImages = new ArrayList<>();
        if (images != null) {
            for (MultipartFile file : images) {
                if (file.isEmpty()) continue;
                if (file.getSize() > MAX_FILE_SIZE) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "ขนาดไฟล์รูปภาพเกินกำหนด (สูงสุด 5MB)");
                }
                String contentType = file.getContentType();
                if (contentType == null || !ALLOWED_TYPES.containsKey(contentType.toLowerCase())) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "รองรับเฉพาะไฟล์รูปภาพ PNG, JPEG, JPG และ WEBP เท่านั้น");
                }
                validImages.add(file);
            }
        }
        if (validImages.size() > maxImages) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "แนบรูปได้สูงสุด " + maxImages + " รูป");
        }
        return validImages;
    }

    public Path save(MultipartFile file) throws IOException {
        Files.createDirectories(UPLOAD_PATH);
        String fileName = UUID.randomUUID() + extensionFor(file);
        Path target = UPLOAD_PATH.resolve(fileName);
        Files.copy(file.getInputStream(), target);
        return target;
    }

    private String extensionFor(MultipartFile file) {
        String contentType = file.getContentType();
        String extension = contentType == null ? null : ALLOWED_TYPES.get(contentType.toLowerCase());
        if (extension == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ชนิดไฟล์รูปภาพไม่รองรับ");
        }
        return extension;
    }

    public String urlOf(Path file) {
        return "/uploads/" + file.getFileName();
    }

    public Path pathOf(String imageUrl) {
        return UPLOAD_PATH.resolve(Paths.get(imageUrl).getFileName());
    }

    public void deleteQuietly(List<Path> files) {
        for (Path p : files) {
            try {
                Files.deleteIfExists(p);
            } catch (IOException ignored) {
            }
        }
    }
}
