#!/bin/bash
cd /home/user/webapp
exec npx serve dist --single -l tcp://0.0.0.0:3000
