# Usamos la imagen oficial de Nginx basada en Alpine por ser liviana
FROM nginx:alpine

# Copiamos todo el contenido de nuestro proyecto local al directorio por defecto de Nginx
COPY . /usr/share/nginx/html/

# Exponemos el puerto estándar HTTP
EXPOSE 80

# El comando por defecto para que Nginx se quede corriendo y no se apague el contenedor
CMD ["nginx", "-g", "daemon off;"]