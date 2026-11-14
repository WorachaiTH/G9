package com.tu.lostandfound.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "claims")
public class Claim {
    public enum ClaimStatus { pending, confirmed, rejected }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "contact_name", nullable = false, length = 100)
    private String contactName;

    @Column(name = "contact_info", nullable = false, length = 255)
    private String contactInfo;

    @Column(name = "requester_employee_id", nullable = false, length = 100)
    private String requesterEmployeeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ClaimStatus status = ClaimStatus.pending;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @OneToMany(mappedBy = "claim", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<ClaimImage> images = new ArrayList<>();

    @PrePersist
    protected void onCreate() { createdAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }
    public String getContactInfo() { return contactInfo; }
    public void setContactInfo(String contactInfo) { this.contactInfo = contactInfo; }
    public String getRequesterEmployeeId() { return requesterEmployeeId; }
    public void setRequesterEmployeeId(String requesterEmployeeId) { this.requesterEmployeeId = requesterEmployeeId; }
    public ClaimStatus getStatus() { return status; }
    public void setStatus(ClaimStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Post getPost() { return post; }
    public void setPost(Post post) { this.post = post; }
    public List<ClaimImage> getImages() { return images; }
}
