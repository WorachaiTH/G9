package com.tu.lostandfound.service;

import com.tu.lostandfound.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class UploadService {

    public static final int MAX_POST_IMAGES = 5;
    public static final int MAX_CLAIM_IMAGES = 2;
    public static final Set<String> POST_IMAGE_TYPES = Set.of("image/jpeg", "image/png");
    public static final Set<String> CLAIM_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private static final Path UPLOAD_PATH = Paths.get("uploads");
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    public List<MultipartFile> validate(MultipartFile[] images) {
        return validate(images, MAX_POST_IMAGES, POST_IMAGE_TYPES);
    }

    public List<MultipartFile> validate(MultipartFile[] images, int maxCount, Set<String> allowedTypes) {
        List<MultipartFile> validImages = new ArrayList<>();
        if (images != null) {
            for (MultipartFile file : images) {
                if (file == null || file.isEmpty()) continue;
                if (file.getSize() > MAX_FILE_SIZE) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "ขนาดไฟล์รูปภาพเกินกำหนด (สูงสุด 5MB)");
                }
                String contentType = file.getContentType();
                if (contentType == null || !allowedTypes.contains(contentType)) {
                    throw new ApiException(HttpStatus.BAD_REQUEST,
                            "รองรับเฉพาะไฟล์รูปภาพ " + describe(allowedTypes) + " เท่านั้น");
                }
                validImages.add(file);
            }
        }
        if (validImages.size() > maxCount) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "แนบรูปได้สูงสุด " + maxCount + " รูป");
        }
        return validImages;
    }

    public Path save(MultipartFile file) throws IOException {
        Files.createDirectories(UPLOAD_PATH);
        String fileName = UUID.randomUUID() + EXTENSIONS.get(file.getContentType());
        Path target = UPLOAD_PATH.resolve(fileName);
        Files.copy(file.getInputStream(), target);
        return target;
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

    public void deleteAfterCommit(List<Path> files) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteQuietly(files);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteQuietly(files);
            }
        });
    }

    public void deleteOnRollback(List<Path> files) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    deleteQuietly(files);
                }
            }
        });
    }

    private static String describe(Set<String> types) {
        List<String> names = new ArrayList<>();
        if (types.contains("image/jpeg")) names.add("JPG");
        if (types.contains("image/png")) names.add("PNG");
        if (types.contains("image/webp")) names.add("WEBP");
        return String.join(", ", names);
    }
}
