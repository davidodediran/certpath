# 🚀 AWS EC2 + ALB + HTTPS (ACM) + ALB Access Restriction Guide

## 📌 Overview
This guide documents how to:
- Host an application on **EC2**
- Use an **Application Load Balancer (ALB)**
- Configure **HTTPS using AWS Certificate Manager (ACM)**
- Connect a **custom domain & subdomain**
- Restrict direct ALB access (domain-only access)
- Enable **secure access (HTTPS)**

---

## 🧱 Architecture

User → HTTPS (443) → ALB → HTTP → EC2
                ↑
         ACM Certificate
                ↑
         Route 53 DNS

---

## 🔐 ALB Access Restriction (IMPORTANT)

### 🎯 Goal
Ensure your app is ONLY accessible via your domain:
- certpath.online
- app.certpath.online

Block direct access via:
- *.elb.amazonaws.com ❌

---

## ⚖️ Rule Configuration (ALB Listener - HTTPS:443)

### Rule 1 (Priority 1 - Allow Traffic)

Condition:
Host header =
- certpath.online
- app.certpath.online

Action:
Forward → Target Group (EC2)

---

### Default Rule (Deny Everything Else)

Action:
Return fixed response
Status Code: 403 Forbidden

---

## 🧠 How Priority Works

- Lower number = higher priority
- Rules are evaluated top → bottom

Example:

Priority 1 → Allow your domain  
Default → Block everything else  

---

## 🔥 Final Behavior

IF Host = certpath.online OR app.certpath.online  
→ Forward to EC2 ✅  

ELSE  
→ 403 Forbidden ❌  

---

## 🧪 Testing

✅ Works:
https://certpath.online  
https://app.certpath.online  

❌ Blocked:
https://your-alb.amazonaws.com  

---

## 🎉 Result

✔ Secure HTTPS enabled  
✔ Domain routing working  
✔ Direct ALB access blocked  
✔ Production-ready security improvement  

---

## 🚀 Notes

- This does NOT hide the ALB DNS
- It prevents unauthorized access via ALB endpoint
- Recommended for all production setups

---

**Done ✅**
