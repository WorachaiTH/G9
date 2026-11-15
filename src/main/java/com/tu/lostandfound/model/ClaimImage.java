package com.tu.lostandfound.model;

import jakarta.persistence.*;

@Entity
@Table(name = "claim_images")
public class ClaimImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "url", nullable = false, length = 500)
    private String imageUrl;

    @Column(name = "mime_type", length = 50)
    private String mimeType;

    @Column(name = "size_bytes")
    private Integer sizeBytes;

    @Column(name = "sort_order")
    private Short sortOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "claim_id", nullable = false)
    private Claim claim;

    public ClaimImage() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public Integer getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(Integer sizeBytes) { this.sizeBytes = sizeBytes; }

    public Short getSortOrder() { return sortOrder; }
    public void setSortOrder(Short sortOrder) { this.sortOrder = sortOrder; }

    public Claim getClaim() { return claim; }
    public void setClaim(Claim claim) { this.claim = claim; }
}
