
appdir="."
user=vflam
server="vflam@newrecruit.eu"
target="/home/vflam/nr-translate"

# Remove the sym links
[ -f ./.output/data ] && rm ./.output/data
[ -f ./.output/api ] && rm ./.output/api

# Persis ssh connection
ssh -f -N -M -S /tmp/ssh_socket -o ControlPersist=600 $server

# Stop the server
# ssh $server "echo NRnge23? | sudo -S service translate stop"

# Copy files
rsync -pogtrzvL $appdir/.output $server:$target

# Start the server
# ssh $server "echo NRnge23? | sudo -S service translate start"