# GDG Tech Challenge — question bank

**12 questions · 4m15s answer time · estimated 9–11 min including entry, reveals and podium.**

All questions are in English. `Correct` is given for host editing; never reveal it to participants until the question is over.

## 01. Git — 15s (warmup)

**Which Git command downloads remote updates without merging them into your current branch?**

- **A**. git pull
- **B**. git fetch
- **C**. git merge
- **D**. git push

**Correct: B — git fetch**
Explanation: git fetch downloads remote objects and updates remote-tracking references without merging into the current branch.

## 02. Linux / CLI — 15s (warmup)

**Which command recursively searches for the text TODO inside files under src/?**

- **A**. grep -n "TODO" src/
- **B**. find src/ -name "TODO"
- **C**. ls src/ | grep "TODO"
- **D**. grep -r "TODO" src/

**Correct: D — grep -r "TODO" src/**
Explanation: The -r flag makes grep search files recursively through subdirectories.

## 03. Python — 20s (intermediate)

**What will this Python code print?**

```python
data = [1, 2]
alias = data
alias.append(3)
print(data)
```

- **A**. [1, 2]
- **B**. [3]
- **C**. [1, 2, 3]
- **D**. TypeError

**Correct: C — [1, 2, 3]**
Explanation: alias and data refer to the same mutable list; append changes that list in place.

## 04. Networking / HTTP — 20s (intermediate)

**An authenticated user requests an API resource but lacks permission. Which HTTP status best fits?**

- **A**. 403 Forbidden
- **B**. 401 Unauthorized
- **C**. 404 Not Found
- **D**. 500 Internal Server Error

**Correct: A — 403 Forbidden**
Explanation: 403 means the server understands the request but refuses authorization; 401 requests authentication credentials.

## 05. JavaScript — 20s (intermediate)

**What will this JavaScript code print?**

```javascript
const values = [1, 2, 3, 4];
console.log(values.filter(x => x % 2 === 0).map(x => x * 2));
```

- **A**. [2, 4]
- **B**. [4, 8]
- **C**. [1, 4, 9, 16]
- **D**. [2, 4, 6, 8]

**Correct: B — [4, 8]**
Explanation: filter selects 2 and 4; map doubles them to 4 and 8.

## 06. Docker — 20s (intermediate)

**In docker run -p 8080:80 nginx, which port on your Mac is mapped to port 80 inside the container?**

```bash
docker run -p 8080:80 nginx
```

- **A**. 80
- **B**. 443
- **C**. 3000
- **D**. 8080

**Correct: D — 8080**
Explanation: Docker -p uses HOST_PORT:CONTAINER_PORT, so host port 8080 forwards to container port 80.

## 07. Linux permissions — 20s (intermediate)

**After chmod 640 notes.txt, which permissions does the file have?**

```bash
chmod 640 notes.txt
```

- **A**. Owner read/write; group read; others none
- **B**. Owner read/execute; group read/write; others none
- **C**. Owner read/write/execute; group read; others none
- **D**. Owner read; group write; others read

**Correct: A — Owner read/write; group read; others none**
Explanation: Octal 6 means read+write, 4 means read, and 0 means no permissions.

## 08. Cybersecurity / Web — 20s (intermediate)

**What does the HttpOnly attribute on a session cookie primarily protect against?**

- **A**. Sending cookies over unencrypted HTTP
- **B**. Sending cookies in cross-site requests
- **C**. JavaScript reading the cookie through document.cookie
- **D**. The cookie expiring too soon

**Correct: C — JavaScript reading the cookie through document.cookie**
Explanation: HttpOnly prevents client-side JavaScript from reading the cookie; Secure and SameSite serve different purposes.

## 09. Cybersecurity / SQL — 25s (challenge)

**Why is a parameterized query safer than concatenating user input into SQL?**

```python
cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
```

- **A**. It always makes the query run faster
- **B**. It separates input data from SQL syntax, reducing SQL injection risk
- **C**. It automatically encrypts database fields
- **D**. It enforces role-based access control

**Correct: B — It separates input data from SQL syntax, reducing SQL injection risk**
Explanation: Bound parameters are treated as data, so user input cannot change the SQL statement structure.

## 10. Google Developer tools — 25s (challenge)

**Which Google/Firebase product is a document-oriented NoSQL database often used in web or mobile apps?**

- **A**. Cloud Run
- **B**. Firebase Hosting
- **C**. Cloud Firestore
- **D**. BigQuery

**Correct: C — Cloud Firestore**
Explanation: Cloud Firestore is a document-oriented NoSQL database; the other services serve hosting, compute, or analytics roles.

## 11. AI / Semantic Search — 25s (challenge)

**In semantic search, what is the main purpose of a text embedding?**

- **A**. Represent text as a numeric vector capturing semantic relationships
- **B**. Create an exact keyword index without vectors
- **C**. Encrypt a text passage before storing it
- **D**. Generate the final chatbot answer directly

**Correct: A — Represent text as a numeric vector capturing semantic relationships**
Explanation: An embedding is a vector representation that lets systems compare semantic similarity.

## 12. JavaScript / Event Loop — 30s (final)

**In a typical JavaScript runtime, in what order are these messages logged?**

```javascript
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");
```

- **A**. A B C D
- **B**. A D B C
- **C**. A C D B
- **D**. A D C B

**Correct: D — A D C B**
Explanation: Synchronous logs run first (A, D), the Promise microtask runs next (C), then the timer callback (B).
