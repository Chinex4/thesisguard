-- Optional academic directory seed. No passwords or fabricated auth.users.
insert into public.faculties(id,name,code) values
('a1000000-0000-4000-8000-000000000001','Faculty of science','FOS'),
('a1000000-0000-4000-8000-000000000002','Management Sciences','FMS'),
('a1000000-0000-4000-8000-000000000004','SOCIAL Sciences','FSS'),
('a1000000-0000-4000-8000-000000000004','MEDICAL Sciences','BMS'),
('a1000000-0000-4000-8000-000000000003','Engineering','ENG') on conflict(id) do nothing;
insert into public.departments(id,faculty_id,name,code) values
('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Computer Science','CSC'),
('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Statistics','STA'),
('b1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002','Business Administration','BUS'),
('b1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000003','Electrical Engineering','EEE') on conflict(id) do nothing;
