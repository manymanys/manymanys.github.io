---
layout: page
title: News & Events
permalink: /news/
---

{% for post in site.posts %}
  <h2>{{ post.title }}</h2>
  <p><em>Posted on {{ post.date | date: "%B %-d, %Y" }}</em></p>
  {{ post.content }}
  <hr>
{% endfor %}