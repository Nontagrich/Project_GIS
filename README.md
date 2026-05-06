https://drive.google.com/drive/folders/1V3w-AoGnBFpKxbna_ksGRNlDFy61vEaU?usp=sharing

## 📂 Project Data Structure

### 🔹 Dataset for Training
- **`Train_Data`**  
  Used for training the model  
  ➜ Place this folder inside `{DATA}`

---

### 🔹 Data for Web Application
- **`{year}` (e.g., 2018, 2019, ...)**  
  Used as input for the web application  
  ➜ Place these folders inside `{WEBAPP}`

---

### 🔹 Pre-trained Model
- **`autogluon_vci_model`**  
  Pre-trained model for the web application  
  ➜ Place this folder inside `{WEBAPP}`

---

### 📁 Example Folder Structure
```bash
project_root/
│
├── DATA/
│   └── Train_Data/
│
├── WEBAPP/
│   ├── 2022/
│   ├── 2023/
│   ├── 2024/
│   └── autogluon_vci_model/
