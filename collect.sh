#!/bin/bash

# Имя выходного файла
OUTPUT="sum.log"

# Очищаем или создаем пустой файл перед началом сборки
> "$OUTPUT"

# Находим все файлы в текущей директории и поддиректориях
find . -type f | while read -r file; do
    # Убираем префикс "./" для красивого вывода
    clean_path="${file#./}"
    
    # Пропускаем сам скрипт и файл лога, чтобы избежать самозаписи
    if [[ "$clean_path" != "$OUTPUT" && "$clean_path" != "$(basename "$0")" ]]; then
        echo "=== FILE: $clean_path ===" >> "$OUTPUT"
        cat "$file" >> "$OUTPUT"
        echo -e "\n\n" >> "$OUTPUT" # Добавляем отступы между файлами
    fi
done

echo "Сборка завершена! Все данные записаны в $OUTPUT"
