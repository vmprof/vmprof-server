# import os
# import pytest
# import hashlib



# from vmprof.models import Log


# def read_log(name):
#     here = os.path.dirname(__file__)

#     with open(os.path.join(here, 'test.prof')) as fp:
#         return fp.read().decode('ascii', 'ignore')


# @pytest.mark.django_db
# def test_submit(client):

#     data = {
#         'prof': read_log('test.prof'),
#         'prof_sym': read_log('test.prof.sym')
#     }

#     response = client.post('/submit/', data=data)

#     assert Log.objects.get(checksum=response.content)
#     assert Log.objects.count() == 1


# # @pytest.mark.django_db
# # def test_log(client):

# #     prof = read_log('test.prof')
# #     prof_sym = read_log('test.prof.sym')

# #     log = Log.objects.create(prof=prof, prof_sym=prof_sym)

# #     response = client.get('/%s/' % log.checksum)

# #     import pdb; pdb.set_trace()

