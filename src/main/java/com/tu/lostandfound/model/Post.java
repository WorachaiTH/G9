package com.tu.lostandfound.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "posts")
public class Post {

    public enum PostStatus {
        pending_review, published, claimed, returned, expired, hidden
    }

    public enum ContactType {
        phone, line, email, other
    }

    public enum PostType {
        lost, found
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "post_type")
    private PostType type = PostType.lost;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(name = "found_location")
    private String location;

    @Column(name = "found_at")
    private LocalDateTime dateTime;

    @Column(name = "reporter_name", length = 100)
    private String contactName;

    @Column(name = "reporter_contact")
    private String contactInfo;

    @Enumerated(EnumType.STRING)
    @Column(name = "contact_type")
    private ContactType contactType;

    @Column(name = "author_email")
    private String authorEmail = "anonymous@tu.ac.th";

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private PostStatus status = PostStatus.pending_review;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "post", fetch = FetchType.EAGER)
    @OrderBy("sortOrder ASC")
    private List<PostImage> images = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Post() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public PostType getType() { return type; }
    public void setType(PostType type) { this.type = type; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public LocalDateTime getDateTime() { return dateTime; }
    public void setDateTime(LocalDateTime dateTime) { this.dateTime = dateTime; }

    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }

    public String getContactInfo() { return contactInfo; }
    public void setContactInfo(String contactInfo) { this.contactInfo = contactInfo; }

    public ContactType getContactType() { return contactType; }
    public void setContactType(ContactType contactType) { this.contactType = contactType; }

    public String getAuthorEmail() { return authorEmail; }
    public void setAuthorEmail(String authorEmail) { this.authorEmail = authorEmail; }

    public PostStatus getStatus() { return status; }
    public void setStatus(PostStatus status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public List<PostImage> getImages() { return images; }
}