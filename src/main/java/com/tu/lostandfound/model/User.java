package com.tu.lostandfound.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email", nullable = false, unique = true)
    private String employeeId;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    public User() {}

    public User(String employeeId, String password) {
        this.employeeId = employeeId;
        this.password = password;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}