FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG SUPABASE_URL=https://your-project-ref.supabase.co
ARG SUPABASE_ANON_KEY=your-anon-key

RUN sed -i "s#https://your-project-ref.supabase.co#${SUPABASE_URL}#g" src/environments/environment.prod.ts \
  && sed -i "s#your-anon-key#${SUPABASE_ANON_KEY}#g" src/environments/environment.prod.ts \
  && npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/food-tracker/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
