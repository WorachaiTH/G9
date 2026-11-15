package com.tu.lostandfound.service;

import com.tu.lostandfound.dto.PostDto;
import com.tu.lostandfound.dto.PostUpdateRequest;
import com.tu.lostandfound.exception.ApiException;
import com.tu.lostandfound.model.Claim;
import com.tu.lostandfound.model.ClaimImage;
import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.model.PostImage;
import com.tu.lostandfound.repository.ClaimRepository;
import com.tu.lostandfound.repository.PostImageRepository;
import com.tu.lostandfound.repository.PostRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class PostService {

    public static final Set<Post.PostStatus> PUBLIC_STATUSES = Set.of(
            Post.PostStatus.pending_review,
            Post.PostStatus.published,
            Post.PostStatus.claimed);

    static final Set<Post.PostStatus> EDITABLE_STATUSES = Set.of(
            Post.PostStatus.pending_review,
            Post.PostStatus.published);

    static final int MAX_KEYWORD_LENGTH = 100;

    private final PostRepository postRepository;
    private final PostImageRepository postImageRepository;
    private final ClaimRepository claimRepository;
    private final UploadService uploadService;

    public PostService(PostRepository postRepository,
                       PostImageRepository postImageRepository,
                       ClaimRepository claimRepository,
                       UploadService uploadService) {
        this.postRepository = postRepository;
        this.postImageRepository = postImageRepository;
        this.claimRepository = claimRepository;
        this.uploadService = uploadService;
    }

    @Transactional(readOnly = true)
    public List<PostDto> search(String q, Post.PostStatus status, String viewerId) {
        Set<Post.PostStatus> statuses;
        if (status == null) {
            statuses = PUBLIC_STATUSES;
        } else if (PUBLIC_STATUSES.contains(status)) {
            statuses = Set.of(status);
        } else {
            return List.of();
        }

        String keyword = normalizeKeyword(q);
        List<Post> posts = keyword == null
                ? postRepository.findByStatusInOrderByCreatedAtDesc(statuses)
                : postRepository.searchByKeyword("%" + keyword + "%", statuses);

        return posts.stream().map(post -> PostDto.from(post, viewerId)).toList();
    }

    @Transactional(readOnly = true)
    public List<PostDto> listMine(String employeeId, String q, Post.PostStatus status) {
        String keyword = normalizeKeyword(q);
        String pattern = keyword == null ? null : "%" + keyword + "%";
        return postRepository.findMine(employeeId, pattern, status).stream()
                .map(post -> PostDto.from(post, employeeId))
                .toList();
    }

    static String normalizeKeyword(String q) {
        if (q == null) return null;
        String cleaned = q.trim().replaceAll("\\s+", " ");
        if (cleaned.isEmpty()) return null;
        if (cleaned.length() > MAX_KEYWORD_LENGTH) {
            cleaned = cleaned.substring(0, MAX_KEYWORD_LENGTH);
        }
        return cleaned.toLowerCase(Locale.ROOT)
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
    }

    @Transactional
    public PostDto create(Post post, MultipartFile[] images, String employeeId) {
        if (isBlank(post.getLocation()) || isBlank(post.getContactInfo())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "กรุณากรอกสถานที่และช่องทางติดต่อ");
        }

        if (isBlank(post.getTitle()) && isBlank(post.getDescription())) {
            post.setTitle("รายการของหาย/พบของ");
            post.setDescription(post.getTitle());
        } else if (isBlank(post.getTitle())) {
            post.setTitle(post.getDescription());
        } else if (isBlank(post.getDescription())) {
            post.setDescription(post.getTitle());
        }

        if (post.getTitle().length() > 255) {
            post.setTitle(post.getTitle().substring(0, 255));
        }

        post.setId(null);
        post.getImages().clear();
        post.setAuthorEmail(employeeId);
        post.setStatus(Post.PostStatus.published);
        post.setGrantedAt(null);
        if (post.getType() == null) {
            post.setType(Post.PostType.lost);
        }

        List<MultipartFile> validImages = uploadService.validate(images);

        List<Path> savedFiles = new ArrayList<>();
        uploadService.deleteOnRollback(savedFiles);

        Post savedPost = postRepository.save(post);
        try {
            int order = 1;
            for (MultipartFile file : validImages) {
                Path target = uploadService.save(file);
                savedFiles.add(target);

                PostImage postImage = new PostImage();
                postImage.setImageUrl(uploadService.urlOf(target));
                postImage.setMimeType(file.getContentType());
                postImage.setSizeBytes((int) file.getSize());
                postImage.setSortOrder((short) order++);
                postImage.setPost(savedPost);
                savedPost.getImages().add(postImageRepository.save(postImage));
            }
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "บันทึกรูปภาพไม่สำเร็จ");
        }
        return PostDto.from(savedPost, employeeId);
    }

    @Transactional
    public PostDto update(Long id, String employeeId, PostUpdateRequest request,
                          MultipartFile[] newImages, List<Long> removeImageIds) {
        Post post = postRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ไม่พบโพสต์นี้"));

        if (!employeeId.equals(post.getAuthorEmail())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "แก้ไขได้เฉพาะโพสต์ของตัวเอง");
        }
        if (!EDITABLE_STATUSES.contains(post.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "โพสต์นี้มีคำขอรับอยู่หรือปิดไปแล้ว จึงแก้ไขไม่ได้");
        }

        if (request == null || isBlank(request.description())
                || isBlank(request.location()) || isBlank(request.contactInfo())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "กรุณากรอกรายละเอียด สถานที่ และช่องทางติดต่อให้ครบ");
        }
        String contactName = isBlank(request.contactName()) ? null : request.contactName().trim();
        if (contactName != null && contactName.length() > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ชื่อผู้ติดต่อยาวเกินกำหนด");
        }

        List<PostImage> toRemove = findImagesToRemove(post.getId(), removeImageIds);
        List<MultipartFile> validImages = uploadService.validate(newImages);
        int remaining = post.getImages().size() - toRemove.size();
        if (remaining + validImages.size() > UploadService.MAX_POST_IMAGES) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "แนบรูปได้สูงสุด " + UploadService.MAX_POST_IMAGES + " รูป");
        }

        String description = request.description().trim();
        String title = isBlank(request.title()) ? description : request.title().trim();
        if (title.length() > 255) {
            title = title.substring(0, 255);
        }
        post.setTitle(title);
        post.setDescription(description);
        post.setLocation(request.location().trim());
        post.setContactName(contactName);
        post.setContactInfo(request.contactInfo().trim());
        post.setContactType(request.contactType());

        List<Path> removedFiles = new ArrayList<>();
        for (PostImage image : toRemove) {
            removedFiles.add(uploadService.pathOf(image.getImageUrl()));
        }
        postImageRepository.deleteAll(toRemove);
        post.getImages().removeAll(toRemove);

        int order = post.getImages().stream()
                .map(PostImage::getSortOrder)
                .filter(sortOrder -> sortOrder != null)
                .mapToInt(Short::intValue)
                .max()
                .orElse(0) + 1;

        List<Path> savedFiles = new ArrayList<>();
        uploadService.deleteOnRollback(savedFiles);
        try {
            for (MultipartFile file : validImages) {
                Path target = uploadService.save(file);
                savedFiles.add(target);

                PostImage postImage = new PostImage();
                postImage.setImageUrl(uploadService.urlOf(target));
                postImage.setMimeType(file.getContentType());
                postImage.setSizeBytes((int) file.getSize());
                postImage.setSortOrder((short) order++);
                postImage.setPost(post);
                post.getImages().add(postImageRepository.save(postImage));
            }
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "บันทึกรูปภาพไม่สำเร็จ");
        }

        Post saved = postRepository.save(post);
        uploadService.deleteAfterCommit(removedFiles);
        return PostDto.from(saved, employeeId);
    }

    private List<PostImage> findImagesToRemove(Long postId, List<Long> removeImageIds) {
        if (removeImageIds == null || removeImageIds.isEmpty()) {
            return List.of();
        }
        List<Long> ids = removeImageIds.stream().filter(imageId -> imageId != null).distinct().toList();
        List<PostImage> images = postImageRepository.findAllById(ids);
        boolean allBelongToPost = images.size() == ids.size()
                && images.stream().allMatch(image -> postId.equals(image.getPost().getId()));
        if (!allBelongToPost) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "มีรูปที่จะลบไม่ใช่รูปของโพสต์นี้");
        }
        return images;
    }

    @Transactional
    public void delete(Long id, String employeeId) {
        Post post = postRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ไม่พบโพสต์นี้"));

        if (!employeeId.equals(post.getAuthorEmail())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ลบได้เฉพาะโพสต์ของตัวเอง");
        }

        removeWithFiles(post);
    }

    @Transactional
    public void deleteExpired(Long id) {
        postRepository.findByIdForUpdate(id)
                .filter(post -> post.getStatus() == Post.PostStatus.returned)
                .ifPresent(this::removeWithFiles);
    }

    private void removeWithFiles(Post post) {
        List<Path> filesToDelete = new ArrayList<>();

        List<Claim> claims = claimRepository.findByPostIdOrderByCreatedAtDesc(post.getId());
        for (Claim claim : claims) {
            for (ClaimImage image : claim.getImages()) {
                filesToDelete.add(uploadService.pathOf(image.getImageUrl()));
            }
        }

        List<PostImage> images = postImageRepository.findByPostIdOrderBySortOrderAsc(post.getId());
        for (PostImage image : images) {
            filesToDelete.add(uploadService.pathOf(image.getImageUrl()));
        }

        claimRepository.deleteAll(claims);
        postImageRepository.deleteAll(images);
        post.getImages().clear();
        postRepository.delete(post);
        postRepository.flush();

        uploadService.deleteAfterCommit(filesToDelete);
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
