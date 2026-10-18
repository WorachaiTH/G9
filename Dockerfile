# ขั้นตอนที่ 1: แปลงโค้ด Java ในโฟลเดอร์ src ให้เป็นไฟล์โปรแกรม (.jar)
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# ขั้นตอนที่ 2: นำไฟล์ .jar มารันในกล่อง Java ขนาดเล็ก
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]