#!/bin/bash

# Имя выходного файла
OUTPUT="sum.log"

# Очищаем или создаем пустой файл перед началом сборки
> "$OUTPUT"

# Получаем имя самого скрипта
SCRIPT_NAME=$(basename "$0")

# Находим все файлы, ИСКЛЮЧАЯ папку .git, сам скрипт и выходной лог
find . -type f \
    ! -path "./.git/*" \
    ! -name "$SCRIPT_NAME" \
    ! -name "$OUTPUT" | while read -r file; do

    # Убираем префикс "./" для красивого вывода
    clean_path="${file#./}"
    
    echo "=== FILE: $clean_path ===" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo -e "\n\n" >> "$OUTPUT" # Добавляем отступы между файлами
done

echo "Сборка завершена! Все данные записаны в $OUTPUT"
