# **Art Studio Website**

## **01\. At a glance**

## You have 7 days to build a small, reliable website for an art  studio:  buy paintings, book a wall painting, and request custom pottery, with two roles: customer and studio.

* **Format:** Full-stack build, submitted as a GitHub repository  
* **Submit by: 23-10-2026 (11:59 PM IST)**  
* **Tech stack:** Your choice  
* **Database:** Your choice. We prefer cloud-hosted databases, but your choice will not affect evaluation.

**Partial submissions are welcome.** You do not need to build everything in this brief. Build what you can in the given time, make it work properly, and mention in your DESIGN.md what you finished and what you left out. A small app that works beats a large one that breaks.

**Seed Dataset:**  [seedData.zip](https://drive.google.com/open?id=1ltlMKcxjvnssicoTakv4vfrFWCu69C7u)

## **02\. What the studio does**

The studio does three things. 

### **1 · Sells paintings**

* Each painting is one of a kind, so it can be bought only once.  
* The studio adds paintings. A customer buys an available one.  
* A customer can cancel an order, and the painting becomes available again.

  ### 

  ### 

  ### 

  ### 

  ### **2 · Paints walls, on booking**

* A customer picks a date from 7 to 90 days away, and gives the wall size (10 to 500 sq ft) and the address.  
* Each date can be booked only once.  
* The studio confirms or declines the booking.  
* A customer can cancel until 3 days before the date.  
* The price is the wall size times a rate from the seed data. 

  ### **3 · Makes custom pottery, on request**

* A customer chooses an item and glaze from the seed data, a quantity (1 to 12\) and a needed-by date at least 14 days away.  
* The studio accepts or declines the request.  
* A customer can edit or cancel a request only while it is still `requested`.

**Status:** an order is `placed` or `cancelled`. A booking is `requested`, `confirmed`, `declined` or `cancelled`. A pottery request is `requested`, `accepted`, `declined` or `cancelled`.

**RBAC (Role Based Access Control)**

| Action | Customer | Admin |
| :---- | :---- | :---- |
| Browse paintings | Yes | Yes |
| Add or edit a painting (only while available) | No | Yes |
| Buy a painting, book a wall date, request pottery | Yes | No |
| See orders, bookings and pottery requests | Yes (only what they own) | All |
| Confirm or decline a booking, accept or decline a pottery request | No | Yes |
| Cancel an order, booking or request | Yes (only what they own) | No |

The server checks the role on every request. Not logged in is refused (401), the wrong role is refused (403), and a customer asking for someone else's record gets "not found" (404).

## **03 · Data and interface**

* Every screen that loads data shows a loading, an empty and an error state. When the app refuses something (painting just sold, date just taken), show a clear message.  
* A simple interface is fine. We are not judging visual design.

## **04 · AI tools policy**

You may use AI coding tools while building. What we assess is the final system and your understanding of it.

* Using AI is fine. Submitting code you cannot explain is not.  
* If you are shortlisted, you will be asked to explain your code live, without an AI tool.

## **05 · Submission**

Submit everything through the Google form, before the deadline. This is the only channel we accept.

- **A public GitHub repository** containing your code. Do not commit your API key or your `.env` file. Commit a `.env.example` that lists every variable with a placeholder value.  
- **A README** that lets someone run the app on a clean machine.   
- **A demo recording of 5 minutes at most**, with your voice explaining. Show what you built working, for example sign-up, buying a painting, booking a wall date, requesting pottery, and the studio confirming it, and give a short walkthrough of the code behind one feature. Upload it to Google Drive and **set access to anyone with the link.**  
- **A `DESIGN.md`** with short answers, a few sentences each. Answer only what applies to what you built.  
1. How do login and the two roles work?  
2. Which database did you choose, and why?  
3. How do you stop two people from taking the same painting or date?  
4. What did you finish, what did you leave out, and what would you do next?

## 

## **06 · What you do not need to build**

Do not spend time on these. They are out of scope.

| Area | Out of scope |
| :---- | :---- |
| Payments | Real payments. Buying a painting only creates an order. |
| Accounts | Password reset, email verification, social log-in, studio sign-up |
| Extras | Reviews, coupons, delivery tracking, emails or SMS |
| Interface | Image uploads, fancy styling, animations, mobile layout |
| Delivery | Deployment, Docker, CI/CD |

**Submit what you built.** You do not have to finish everything. Send whatever you have working, and list in your `DESIGN.md` what you completed, what you left out and why. An honest, smaller submission is better than an overreaching one. Everyone applying is at a similar stage and learning as they go, so please don't hold back from submitting. We would be happy to  see what you built rather than nothing at all.

**After you submit:** Shortlisted candidates are invited to an interview. In it,  you might be asked to walk  through your code and explain your decisions.

**For any queries, contact:** 

**Sruthi- 9866832109**  
**Amruth- 9014714939**   
**Santosh- 9182285342**

