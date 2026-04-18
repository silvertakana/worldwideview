import sqlite3
import json
conn = sqlite3.connect('data/wwv.db')
cursor = conn.cursor()
cursor.execute('SELECT id, dataSource FROM installed_plugins')
rows = cursor.fetchall()
for r in rows:
    if r[1]:
        print(f"plugin={r[0]}, dataSource={r[1]}")
